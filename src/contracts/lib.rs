use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

// ⚠️ Se o deploy falhar por address mismatch no playground, atualize este ID.
declare_id!("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");

#[program]
pub mod verum_vesting {
    use super::*;

    // 1. Create Vesting
    // Cria o PDA e transfere tokens do sender para o escrow (Vault)
    pub fn create_vesting(
        ctx: Context<CreateVesting>,
        contract_id: u64,
        total_amount: u64,
        start_time: i64,
        end_time: i64,
        vesting_type: VestingType,
    ) -> Result<()> {
        let vesting_contract = &mut ctx.accounts.vesting_contract;
        
        vesting_contract.creator = ctx.accounts.creator.key();
        vesting_contract.beneficiary = ctx.accounts.beneficiary.key();
        vesting_contract.mint = ctx.accounts.mint.key();
        vesting_contract.total_amount = total_amount;
        vesting_contract.released_amount = 0;
        vesting_contract.start_time = start_time;
        vesting_contract.end_time = end_time;
        vesting_contract.vesting_type = vesting_type;
        vesting_contract.bump = ctx.bumps.vesting_contract;
        vesting_contract.contract_id = contract_id;

        // Transfere tokens do criador para o escrow
        let cpi_accounts = Transfer {
            from: ctx.accounts.sender_token_account.to_account_info(),
            to: ctx.accounts.escrow_wallet.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, total_amount)?;

        Ok(())
    }

    // 2. Claim Tokens
    // Calcula liberado e transfere para ATA do beneficiário
    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let vesting_contract = &mut ctx.accounts.vesting_contract;
        let current_time = Clock::get()?.unix_timestamp;

        // Calcula montante vestado
        let vested_amount = calculate_vested_amount(
            current_time,
            vesting_contract.start_time,
            vesting_contract.end_time,
            vesting_contract.total_amount,
            &vesting_contract.vesting_type,
        );

        // Calcula quanto pode sacar (Vestado - Já Liberado)
        let releasable = vested_amount.checked_sub(vesting_contract.released_amount).unwrap();
        require!(releasable > 0, VestingError::NothingToRelease);

        // Atualiza estado
        vesting_contract.released_amount += releasable;

        // Assinatura do PDA (VestingContract -> Escrow)
        // O escrow_wallet é PDA do vesting_contract, então vesting_contract assina
        let beneficiary_key = vesting_contract.beneficiary;
        let mint_key = vesting_contract.mint;
        let id_bytes = vesting_contract.contract_id.to_le_bytes();
        let bump = vesting_contract.bump;

        let seeds = &[
            b"vesting",
            beneficiary_key.as_ref(),
            mint_key.as_ref(),
            id_bytes.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_wallet.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: vesting_contract.to_account_info(), // Vesting Contract é autoridade do Escrow
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(cpi_ctx, releasable)?;

        Ok(())
    }

    // 3. Update Beneficiary
    // Requer assinatura do criador
    pub fn update_beneficiary(ctx: Context<UpdateBeneficiary>) -> Result<()> {
        let vesting_contract = &mut ctx.accounts.vesting_contract;
        require!(ctx.accounts.creator.key() == vesting_contract.creator, VestingError::Unauthorized);
        
        vesting_contract.beneficiary = ctx.accounts.new_beneficiary.key();
        Ok(())
    }

    // 4. Cancel Vesting
    // Retorna tokens não liberados ao criador
    pub fn cancel_vesting(ctx: Context<CancelVesting>) -> Result<()> {
        let vesting_contract = &mut ctx.accounts.vesting_contract;
        require!(ctx.accounts.creator.key() == vesting_contract.creator, VestingError::Unauthorized);

        // Opcional: Se quiser permitir saque do que JÁ vestou antes de cancelar, chamaria claim logic aqui.
        // Assumindo "cancelar" = parar tudo e devolver restante do escrow.
        
        let escrow_balance = ctx.accounts.escrow_wallet.amount;
        
        if escrow_balance > 0 {
             let beneficiary_key = vesting_contract.beneficiary;
             let mint_key = vesting_contract.mint;
             let id_bytes = vesting_contract.contract_id.to_le_bytes();
             let bump = vesting_contract.bump;

             let seeds = &[
                b"vesting",
                beneficiary_key.as_ref(),
                mint_key.as_ref(),
                id_bytes.as_ref(),
                &[bump],
            ];
            let signer = &[&seeds[..]];

            let cpi_accounts = Transfer {
                from: ctx.accounts.escrow_wallet.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: vesting_contract.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            token::transfer(cpi_ctx, escrow_balance)?;
        }
        
        // Poderia fechar a conta (close_account) se desejado, mas vamos manter o registro marcar como zero
        vesting_contract.total_amount = vesting_contract.released_amount; // Trava
        
        Ok(())
    }
}

// -------------------------------------------------------------------------
// LOGIC HELPERS
// -------------------------------------------------------------------------

fn calculate_vested_amount(
    current_time: i64,
    start: i64,
    end: i64,
    total: u64,
    vesting_type: &VestingType,
) -> u64 {
    if current_time < start {
        return 0;
    }
    if current_time >= end {
        return total;
    }

    match vesting_type {
        VestingType::Linear => {
            let duration = end.checked_sub(start).unwrap() as u64;
            let elapsed = current_time.checked_sub(start).unwrap() as u64;
            (total as u128 * elapsed as u128 / duration as u128) as u64
        },
        VestingType::Cliff => {
            // Exemplo Cliff: 0 até o final, tudo no final?
            // Ou Cliff no meio? Assumindo "Cliff" = tudo no final para este enum simples
            0 
        }
    }
}

// -------------------------------------------------------------------------
// DATA STRUCTURES
// -------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VestingType {
    Linear,
    Cliff,
}

#[account]
pub struct VestingContract {
    pub creator: Pubkey, // Necessário para cancel e update auth
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub contract_id: u64, // Necessário para seeds
    pub vesting_type: VestingType,
    pub bump: u8,
}

impl VestingContract {
    // Espaço: Discriminator (8) + Pubkey(32)*3 + u64*4 + i64*2 + Enum(1) + u8(1)
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1;
}

#[error_code]
pub enum VestingError {
    #[msg("Nada para liberar no momento.")]
    NothingToRelease,
    #[msg("Não autorizado.")]
    Unauthorized,
}

// -------------------------------------------------------------------------
// CONTEXTS
// -------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(contract_id: u64)]
pub struct CreateVesting<'info> {
    #[account(
        init,
        payer = creator,
        seeds = [
            b"vesting",
            beneficiary.key().as_ref(),
            mint.key().as_ref(),
            &contract_id.to_le_bytes()
        ],
        bump,
        space = VestingContract::LEN
    )]
    pub vesting_contract: Account<'info, VestingContract>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// CHECK: Apenas endereço para seed
    pub beneficiary: UncheckedAccount<'info>,
    
    pub mint: Account<'info, Mint>,

    // Escrow owned by the Vesting Contract PDA
    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = vesting_contract,
        seeds = [b"escrow", vesting_contract.key().as_ref()],
        bump
    )]
    pub escrow_wallet: Account<'info, TokenAccount>,

    #[account(mut)]
    pub sender_token_account: Account<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(mut)]
    pub vesting_contract: Account<'info, VestingContract>,
    
    #[account(
        mut,
        seeds = [b"escrow", vesting_contract.key().as_ref()],
        bump
    )]
    pub escrow_wallet: Account<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    // Clock sysvar é implícita no Anchor 0.26+ via Clock::get(), mas pode ser adicionada se version <
}

#[derive(Accounts)]
pub struct UpdateBeneficiary<'info> {
    #[account(mut)]
    pub vesting_contract: Account<'info, VestingContract>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    /// CHECK: Novo beneficiário
    pub new_beneficiary: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelVesting<'info> {
    #[account(mut)]
    pub vesting_contract: Account<'info, VestingContract>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    #[account(mut)]
    pub escrow_wallet: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub creator_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}