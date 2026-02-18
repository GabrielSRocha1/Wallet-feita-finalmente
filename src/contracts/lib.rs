use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// ⚠️ ATENÇÃO: Se o deploy falhar por "address mismatch", o Playground vai pedir para atualizar.
// Se isso acontecer, copie o NOVO ID que ele gerar e coloque aqui.
declare_id!("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");

#[program]
pub mod verum_vesting {
    use super::*;

    /// Inicializa um novo contrato de vesting e transfere os tokens para o cofre (vault).
    pub fn create_vesting(
        ctx: Context<CreateVesting>,
        start_time: i64,
        cliff_seconds: u64,
        duration_seconds: u64,
        total_amount: u64,
        revocable: bool,
    ) -> Result<()> {
        let vesting_account = &mut ctx.accounts.vesting_account;
        
        vesting_account.sender = ctx.accounts.sender.key();
        vesting_account.beneficiary = ctx.accounts.beneficiary.key();
        vesting_account.mint = ctx.accounts.mint.key();
        vesting_account.vault = ctx.accounts.vault.key();
        vesting_account.start_time = start_time;
        vesting_account.cliff_time = start_time + cliff_seconds as i64;
        vesting_account.duration = duration_seconds;
        vesting_account.total_amount = total_amount;
        vesting_account.released_amount = 0;
        vesting_account.revocable = revocable;
        vesting_account.revoked = false;
        vesting_account.bump = ctx.bumps.vault;

        // A chave pública da carteira de custódia fornecida pelo usuário
        vesting_account.custody_wallet = "4xV1aDoKevu6Y8cbsfGnqqYkVzduqZ5badoiVoJfmtmc".parse().unwrap();

        // Transfere os tokens da carteira do remetente para o cofre do programa
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.sender.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, total_amount)?;

        Ok(())
    }

    pub fn release(ctx: Context<Release>) -> Result<()> {
        let vesting_account = &mut ctx.accounts.vesting_account;
        let current_time = Clock::get()?.unix_timestamp;

        let vested = calculate_vested_amount(
            current_time,
            vesting_account.start_time,
            vesting_account.cliff_time,
            vesting_account.duration,
            vesting_account.total_amount,
            vesting_account.revoked,
        );

        let releasable = vested.checked_sub(vesting_account.released_amount).unwrap();
        require!(releasable > 0, VestingError::NothingToRelease);

        vesting_account.released_amount += releasable;

        // Transferência do cofre para o beneficiário usando assinatura do PDA
        let seeds = &[
            b"vault",
            vesting_account.to_account_info().key.as_ref(),
            &[vesting_account.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, releasable)?;

        Ok(())
    }

    pub fn revoke(ctx: Context<Revoke>) -> Result<()> {
        let vesting_account = &mut ctx.accounts.vesting_account;
        
        // Apenas o remetente original ou a carteira de custódia podem revogar
        require!(
            ctx.accounts.authority.key() == vesting_account.sender || 
            ctx.accounts.authority.key() == vesting_account.custody_wallet,
            VestingError::Unauthorized
        );
        
        require!(vesting_account.revocable, VestingError::NotRevocable);
        require!(!vesting_account.revoked, VestingError::AlreadyRevoked);

        let current_time = Clock::get()?.unix_timestamp;
        let vested = calculate_vested_amount(
            current_time,
            vesting_account.start_time,
            vesting_account.cliff_time,
            vesting_account.duration,
            vesting_account.total_amount,
            false,
        );

        let refund_amount = vesting_account.total_amount.checked_sub(vested).unwrap();
        vesting_account.revoked = true;

        // Transfere o restante de volta para o remetente
        let seeds = &[
            b"vault",
            vesting_account.to_account_info().key.as_ref(),
            &[vesting_account.bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.refund_token_account.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, refund_amount)?;

        Ok(())
    }
}

fn calculate_vested_amount(
    current_time: i64,
    start: i64,
    cliff: i64,
    duration: u64,
    total: u64,
    is_revoked: bool,
) -> u64 {
    if is_revoked || current_time >= start + duration as i64 {
        return total;
    }
    if current_time < cliff {
        return 0;
    }
    let elapsed = current_time.checked_sub(start).unwrap() as u64;
    (total * elapsed) / duration
}

#[derive(Accounts)]
pub struct CreateVesting<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub sender_token_account: Account<'info, TokenAccount>,
    /// CHECK: Apenas endereço
    pub beneficiary: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = sender,
        space = 8 + VestingAccount::LEN
    )]
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(
        init,
        payer = sender,
        seeds = [b"vault", vesting_account.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = vault,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Release<'info> {
    /// CHECK: Safe because we only transfer TO this account (AUTOMAÇÃO HABILITADA)
    #[account(mut)]
    pub beneficiary: UncheckedAccount<'info>, // <--- MUDANÇA CRÍTICA AQUI
    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,
    #[account(mut, has_one = vault, has_one = beneficiary)]
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Revoke<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub vesting_account: Account<'info, VestingAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub refund_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct VestingAccount {
    pub sender: Pubkey,
    pub beneficiary: Pubkey,
    pub custody_wallet: Pubkey,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub start_time: i64,
    pub cliff_time: i64,
    pub duration: u64,
    pub total_amount: u64,
    pub released_amount: u64,
    pub revocable: bool,
    pub revoked: bool,
    pub bump: u8,
}

impl VestingAccount {
    pub const LEN: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1;
}

#[error_code]
pub enum VestingError {
    #[msg("Ainda não há tokens para liberar.")]
    NothingToRelease,
    #[msg("Este contrato não é revogável.")]
    NotRevocable,
    #[msg("Este contrato já foi revogado.")]
    AlreadyRevoked,
    #[msg("Operação não autorizada.")]
    Unauthorized,
}