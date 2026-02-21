use anchor_lang::prelude::*;
use anchor_spl::token::Token;
use anchor_spl::token_2022::Token2022;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface};

declare_id!("HMqYLNw1ABgVeFcP2PmwDv6bibcm9y318aTo2g25xQMm");

#[program]
pub mod verum_vesting {
    use super::*;

    pub fn create_vesting(
        ctx: Context<CreateVesting>,
        contract_id: u64,
        total_amount: u64,
        start_time: i64,
        end_time: i64,
        vesting_type: VestingType,
    ) -> Result<()> {
        require!(end_time > start_time, VestingError::InvalidTimeRange);
        require!(total_amount > 0, VestingError::InvalidAmount);

        let vesting_contract = &mut ctx.accounts.vesting_contract;
        let mint_key = ctx.accounts.mint.key();
        let mint_info = ctx.accounts.mint.to_account_info();
        
        // Detecta se é Token-2022 ou SPL Token via owner do mint
        let is_token_2022 = mint_info.owner == &anchor_spl::token_2022::ID;

        vesting_contract.creator = ctx.accounts.creator.key();
        vesting_contract.beneficiary = ctx.accounts.beneficiary.key();
        vesting_contract.mint = mint_key;
        vesting_contract.released_amount = 0;
        vesting_contract.start_time = start_time;
        vesting_contract.end_time = end_time;
        vesting_contract.vesting_type = vesting_type;
        vesting_contract.bump = ctx.bumps.vesting_contract;
        vesting_contract.contract_id = contract_id;
        vesting_contract.is_cancelled = false;
        vesting_contract.is_token_2022 = is_token_2022;

        // Transferência compatível via Interface
        let decimals = ctx.accounts.mint.decimals;

        let cpi_accounts = token_interface::TransferChecked {
            from: ctx.accounts.sender_token_account.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.escrow_wallet.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token_interface::transfer_checked(cpi_ctx, total_amount, decimals)?;

        // Captura o valor real recebido (Essencial para tokens com Transfer Fee / Extensões)
        ctx.accounts.escrow_wallet.reload()?;
        vesting_contract.total_amount = ctx.accounts.escrow_wallet.amount;

        emit!(VestingCreated {
            contract_id,
            creator: ctx.accounts.creator.key(),
            beneficiary: ctx.accounts.beneficiary.key(),
            mint: mint_key,
            total_amount: vesting_contract.total_amount,
            start_time,
            end_time,
        });

        Ok(())
    }

    pub fn claim_tokens(ctx: Context<ClaimTokens>) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;

        let (releasable, signer_seeds_data) = {
            let vesting_contract = &mut ctx.accounts.vesting_contract;

            require!(!vesting_contract.is_cancelled, VestingError::ContractCancelled);

            let vested_amount = calculate_vested_amount(
                current_time,
                vesting_contract.start_time,
                vesting_contract.end_time,
                vesting_contract.total_amount,
                &vesting_contract.vesting_type,
            );

            let releasable = vested_amount
                .checked_sub(vesting_contract.released_amount)
                .ok_or(VestingError::MathOverflow)?;

            require!(releasable > 0, VestingError::NothingToRelease);

            vesting_contract.released_amount = vesting_contract
                .released_amount
                .checked_add(releasable)
                .ok_or(VestingError::MathOverflow)?;

            (
                releasable,
                (
                    vesting_contract.creator,
                    vesting_contract.mint,
                    vesting_contract.contract_id,
                    vesting_contract.bump,
                )
            )
        };

        let (creator_key, mint_key, contract_id, bump) = signer_seeds_data;
        let id_bytes = contract_id.to_le_bytes();

        let seeds = &[
            b"vesting",
            creator_key.as_ref(),
            mint_key.as_ref(),
            id_bytes.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        let decimals = ctx.accounts.mint.decimals;

        let cpi_accounts = token_interface::TransferChecked {
            from: ctx.accounts.escrow_wallet.to_account_info(),
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: ctx.accounts.vesting_contract.to_account_info(),
        };

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );

        token_interface::transfer_checked(cpi_ctx, releasable, decimals)?;

        emit!(TokensClaimed {
            contract_id,
            beneficiary: ctx.accounts.beneficiary.key(),
            amount: releasable,
            timestamp: current_time,
        });

        Ok(())
    }

    pub fn update_beneficiary(ctx: Context<UpdateBeneficiary>) -> Result<()> {
        let vesting_contract = &mut ctx.accounts.vesting_contract;

        require!(!vesting_contract.is_cancelled, VestingError::ContractCancelled);
        require!(vesting_contract.released_amount == 0, VestingError::AlreadyClaimed);

        let old_beneficiary = vesting_contract.beneficiary;
        vesting_contract.beneficiary = ctx.accounts.new_beneficiary.key();

        emit!(BeneficiaryUpdated {
            contract_id: vesting_contract.contract_id,
            old_beneficiary,
            new_beneficiary: ctx.accounts.new_beneficiary.key(),
        });

        Ok(())
    }

    pub fn cancel_vesting(ctx: Context<CancelVesting>) -> Result<()> {
        let current_time = Clock::get()?.unix_timestamp;

        let (escrow_balance, signer_seeds_data) = {
            let vesting_contract = &mut ctx.accounts.vesting_contract;

            require!(!vesting_contract.is_cancelled, VestingError::ContractCancelled);

            let balance = ctx.accounts.escrow_wallet.amount;
            vesting_contract.is_cancelled = true;
            vesting_contract.released_amount = vesting_contract.total_amount;

            (
                balance,
                (
                    vesting_contract.creator,
                    vesting_contract.mint,
                    vesting_contract.contract_id,
                    vesting_contract.bump,
                )
            )
        };

        if escrow_balance > 0 {
            let (creator_key, mint_key, contract_id, bump) = signer_seeds_data;
            let id_bytes = contract_id.to_le_bytes();

            let seeds = &[
                b"vesting",
                creator_key.as_ref(),
                mint_key.as_ref(),
                id_bytes.as_ref(),
                &[bump],
            ];
            let signer = &[&seeds[..]];

            let decimals = ctx.accounts.mint.decimals;

            let cpi_accounts = token_interface::TransferChecked {
                from: ctx.accounts.escrow_wallet.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: ctx.accounts.vesting_contract.to_account_info(),
            };

            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
            
            token_interface::transfer_checked(cpi_ctx, escrow_balance, decimals)?;
        }

        emit!(VestingCancelled {
            contract_id: ctx.accounts.vesting_contract.contract_id,
            creator: ctx.accounts.creator.key(),
            remaining_amount: escrow_balance,
            timestamp: current_time,
        });

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
            let duration = end.saturating_sub(start) as u128;
            let elapsed = current_time.saturating_sub(start) as u128;
            ((total as u128)
                .saturating_mul(elapsed)
                .saturating_div(duration)) as u64
        }
        VestingType::Cliff(cliff_time) => {
            if current_time >= *cliff_time {
                total
            } else {
                0
            }
        }
    }
}

// -------------------------------------------------------------------------
// DATA STRUCTURES
// -------------------------------------------------------------------------

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum VestingType {
    Linear,
    Cliff(i64),
}

#[account]
pub struct VestingContract {
    pub creator: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub contract_id: u64,
    pub vesting_type: VestingType,
    pub bump: u8,
    pub is_cancelled: bool,
    pub is_token_2022: bool,
}

impl VestingContract {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 1 + 1; // 201 bytes aprox
}

#[error_code]
pub enum VestingError {
    #[msg("Nada para liberar no momento.")]
    NothingToRelease,
    #[msg("Nao autorizado.")]
    Unauthorized,
    #[msg("Intervalo de tempo invalido.")]
    InvalidTimeRange,
    #[msg("Quantidade invalida.")]
    InvalidAmount,
    #[msg("Overflow matematico.")]
    MathOverflow,
    #[msg("Contrato ja cancelado.")]
    ContractCancelled,
    #[msg("Tokens ja foram resgatados.")]
    AlreadyClaimed,
    #[msg("Conta de token invalida.")]
    InvalidTokenAccount,
}

// -------------------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------------------

#[event]
pub struct VestingCreated {
    pub contract_id: u64,
    pub creator: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub total_amount: u64,
    pub start_time: i64,
    pub end_time: i64,
}

#[event]
pub struct TokensClaimed {
    pub contract_id: u64,
    pub beneficiary: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct BeneficiaryUpdated {
    pub contract_id: u64,
    pub old_beneficiary: Pubkey,
    pub new_beneficiary: Pubkey,
}

#[event]
pub struct VestingCancelled {
    pub contract_id: u64,
    pub creator: Pubkey,
    pub remaining_amount: u64,
    pub timestamp: i64,
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
            creator.key().as_ref(),
            mint.key().as_ref(),
            &contract_id.to_le_bytes()
        ],
        bump,
        space = VestingContract::LEN
    )]
    pub vesting_contract: Account<'info, VestingContract>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Apenas endereco para seed e armazenamento
    pub beneficiary: UncheckedAccount<'info>,

    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = vesting_contract,
        token::token_program = token_program,
        seeds = [b"escrow", vesting_contract.key().as_ref()],
        bump
    )]
    pub escrow_wallet: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = sender_token_account.mint == mint.key() @ VestingError::InvalidAmount,
        constraint = sender_token_account.owner == creator.key() @ VestingError::Unauthorized
    )]
    pub sender_token_account: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct ClaimTokens<'info> {
    #[account(
        mut,
        has_one = beneficiary @ VestingError::Unauthorized,
        constraint = !vesting_contract.is_cancelled @ VestingError::ContractCancelled
    )]
    pub vesting_contract: Account<'info, VestingContract>,

    #[account(
        mut,
        seeds = [b"escrow", vesting_contract.key().as_ref()],
        bump,
        constraint = escrow_wallet.owner == vesting_contract.key() @ VestingError::Unauthorized,
        constraint = escrow_wallet.mint == vesting_contract.mint @ VestingError::InvalidAmount
    )]
    pub escrow_wallet: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = beneficiary_token_account.mint == vesting_contract.mint @ VestingError::InvalidAmount,
        constraint = beneficiary_token_account.owner == beneficiary.key() @ VestingError::Unauthorized
    )]
    pub beneficiary_token_account: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Validado via has_one no vesting_contract
    pub beneficiary: UncheckedAccount<'info>,

    #[account(
        constraint = mint.key() == vesting_contract.mint @ VestingError::InvalidAmount
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct UpdateBeneficiary<'info> {
    #[account(
        mut,
        has_one = creator @ VestingError::Unauthorized,
        constraint = !vesting_contract.is_cancelled @ VestingError::ContractCancelled
    )]
    pub vesting_contract: Account<'info, VestingContract>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Novo beneficiario
    pub new_beneficiary: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelVesting<'info> {
    #[account(
        mut,
        has_one = creator @ VestingError::Unauthorized,
        constraint = !vesting_contract.is_cancelled @ VestingError::ContractCancelled
    )]
    pub vesting_contract: Account<'info, VestingContract>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", vesting_contract.key().as_ref()],
        bump,
        constraint = escrow_wallet.owner == vesting_contract.key() @ VestingError::Unauthorized,
        constraint = escrow_wallet.mint == vesting_contract.mint @ VestingError::InvalidAmount
    )]
    pub escrow_wallet: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_token_account.mint == vesting_contract.mint @ VestingError::InvalidAmount,
        constraint = creator_token_account.owner == creator.key() @ VestingError::Unauthorized
    )]
    pub creator_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = mint.key() == vesting_contract.mint @ VestingError::InvalidAmount
    )]
    pub mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
}
