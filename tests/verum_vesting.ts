import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { VerumVesting } from "../target/types/verum_vesting";
import {
    TOKEN_PROGRAM_ID,
    createMint,
    createAccount,
    mintTo,
    getAccount,
    getAssociatedTokenAddress,
    createAssociatedTokenAccount
} from "@solana/spl-token";
import { assert } from "chai";

describe("verum_vesting", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.VerumVesting as Program<VerumVesting>;

    // Test vars
    let mint: anchor.web3.PublicKey;
    let senderTokenAccount: anchor.web3.PublicKey;
    let beneficiaryTokenAccount: anchor.web3.PublicKey;

    const sender = provider.wallet as anchor.Wallet;
    const beneficiary = anchor.web3.Keypair.generate();
    const newBeneficiary = anchor.web3.Keypair.generate();

    // Vesting Parameters
    const contractId = new anchor.BN(Date.now());
    const totalAmount = new anchor.BN(1000 * 10 ** 9); // 1000 tokens
    const startTime = new anchor.BN(Math.floor(Date.now() / 1000) - 100); // 100s ago
    const endTime = new anchor.BN(Math.floor(Date.now() / 1000) + 100);   // 100s in future
    const vestingType = { linear: {} }; // Enum variant

    let vestingContractPda: anchor.web3.PublicKey;
    let escrowWalletPda: anchor.web3.PublicKey;
    let vestingContractBump: number;
    let escrowWalletBump: number;

    it("Is initialized!", async () => {
        // 1. Create Mint
        mint = await createMint(
            provider.connection,
            sender.payer,
            sender.publicKey,
            null,
            9
        );

        // 2. Create Sender Token Account and Mint tokens
        senderTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            sender.payer,
            mint,
            sender.publicKey
        );
        await mintTo(
            provider.connection,
            sender.payer,
            mint,
            senderTokenAccount,
            sender.payer,
            10000 * 10 ** 9
        );

        // 3. Derive PDAs
        [vestingContractPda, vestingContractBump] = await anchor.web3.PublicKey.findProgramAddress(
            [
                Buffer.from("vesting"),
                beneficiary.publicKey.toBuffer(),
                mint.toBuffer(),
                contractId.toArrayLike(Buffer, 'le', 8)
            ],
            program.programId
        );

        [escrowWalletPda, escrowWalletBump] = await anchor.web3.PublicKey.findProgramAddress(
            [Buffer.from("escrow"), vestingContractPda.toBuffer()],
            program.programId
        );

        // 4. Create Vesting
        const tx = await program.methods.createVesting(
            contractId,
            totalAmount,
            startTime,
            endTime,
            vestingType
        ).accounts({
            vestingContract: vestingContractPda,
            creator: sender.publicKey,
            beneficiary: beneficiary.publicKey,
            mint: mint,
            escrowWallet: escrowWalletPda,
            senderTokenAccount: senderTokenAccount,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        }).rpc();

        console.log("Create Vesting Signature:", tx);

        // Verify state
        const vestingAccount = await program.account.vestingContract.fetch(vestingContractPda);
        assert.ok(vestingAccount.totalAmount.eq(totalAmount));
        assert.ok(vestingAccount.releasedAmount.eq(new anchor.BN(0)));

        const escrowAccount = await getAccount(provider.connection, escrowWalletPda);
        assert.equal(Number(escrowAccount.amount), Number(totalAmount));
    });

    it("Can claim tokens", async () => {
        // Create Beneficiary ATA
        beneficiaryTokenAccount = await createAssociatedTokenAccount(
            provider.connection,
            sender.payer, // payer can be anyone
            mint,
            beneficiary.publicKey
        );

        // Claim
        try {
            const tx = await program.methods.claimTokens()
                .accounts({
                    vestingContract: vestingContractPda,
                    escrowWallet: escrowWalletPda,
                    beneficiaryTokenAccount: beneficiaryTokenAccount,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .rpc();
            console.log("Claim Signature:", tx);

            // Validate Balance
            const beneficiaryAccount = await getAccount(provider.connection, beneficiaryTokenAccount);
            console.log("Beneficiary Balance after claim:", beneficiaryAccount.amount.toString());
            assert.isAbove(Number(beneficiaryAccount.amount), 0);
        } catch (e) {
            console.error("Claim Error:", e);
            throw e;
        }
    });

    it("Can update beneficiary", async () => {
        await program.methods.updateBeneficiary()
            .accounts({
                vestingContract: vestingContractPda,
                creator: sender.publicKey,
                newBeneficiary: newBeneficiary.publicKey,
            })
            .rpc();

        const account = await program.account.vestingContract.fetch(vestingContractPda);
        assert.ok(account.beneficiary.equals(newBeneficiary.publicKey));
    });

    it("Can cancel vesting", async () => {
        // Need creator token account to receive refund
        // Here creator is sender, so we use senderTokenAccount

        await program.methods.cancelVesting()
            .accounts({
                vestingContract: vestingContractPda,
                creator: sender.publicKey,
                escrowWallet: escrowWalletPda,
                creatorTokenAccount: senderTokenAccount, // Refund to creator
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .rpc();

        // Verify escrow is empty
        const escrowAccount = await getAccount(provider.connection, escrowWalletPda);
        assert.equal(Number(escrowAccount.amount), 0);
    });
});
