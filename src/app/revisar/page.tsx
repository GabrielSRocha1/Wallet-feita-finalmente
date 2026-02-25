"use client";

import React, { useState } from "react";
import Link from "next/link";
import AddressVerificationModal from "@/components/AddressVerificationModal";
import ExitWarningModal from "@/components/ExitWarningModal";
import { useRouter } from "next/navigation";
import { useWallet } from "@/contexts/WalletContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { isAdmin } from "@/utils/rbac";
import NetworkSelector from "@/components/NetworkSelector";
import { Transaction, SystemProgram, PublicKey, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { parseVestingDate } from "@/utils/date-utils";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Program, AnchorProvider, Idl, BN } from '@project-serum/anchor';
import { detectTokenProgram } from "@/utils/tokenProgram";
import { createAssociatedTokenAccountIdempotentInstruction } from '@solana/spl-token';
import { PROGRAM_IDS } from "@/utils/solana-config";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

const IDL: Idl = {
    "version": "0.1.0",
    "name": "verum_vesting",
    "instructions": [
        {
            "name": "createVesting",
            "accounts": [
                { "name": "vestingContract", "isMut": true, "isSigner": false },
                { "name": "creator", "isMut": true, "isSigner": true },
                { "name": "beneficiary", "isMut": false, "isSigner": false },
                { "name": "mint", "isMut": false, "isSigner": false },
                { "name": "escrowWallet", "isMut": true, "isSigner": false },
                { "name": "senderTokenAccount", "isMut": true, "isSigner": false },
                { "name": "systemProgram", "isMut": false, "isSigner": false },
                { "name": "tokenProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "contractId", "type": "u64" },
                { "name": "totalAmount", "type": "u64" },
                { "name": "startTime", "type": "i64" },
                { "name": "endTime", "type": "i64" },
                { "name": "vestingType", "type": { "defined": "VestingType" } }
            ]
        }
    ],
    "types": [
        {
            "name": "VestingType",
            "type": {
                "kind": "enum",
                "variants": [
                    { "name": "Linear" },
                    { "name": "Cliff", "fields": ["i64", "u64"] }
                ]
            }
        }
    ]
};


export default function ReviewPage() {
    const router = useRouter();
    const { publicKey, wallet } = useWallet();
    const { connection, network } = useNetwork();
    const isAdminUser = isAdmin(publicKey);

    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [isTransactionPending, setIsTransactionPending] = useState(false);

    // Draft states
    const [config, setConfig] = useState<any>(null);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [walletAddress, setWalletAddress] = useState<string>("");

    // Load data on mount
    React.useEffect(() => {
        const savedConfig = localStorage.getItem("contract_draft");
        const savedRecipients = localStorage.getItem("recipients_draft");

        // Load wallet address from cookies
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
        };
        const connectedAddress = getCookie('wallet_address');
        if (connectedAddress) setWalletAddress(connectedAddress);

        if (savedConfig) setConfig(JSON.parse(savedConfig));
        if (savedRecipients) setRecipients(JSON.parse(savedRecipients));
    }, []);

    const handleCreateContract = async () => {
        if (!publicKey || !wallet) {
            alert("Por favor, conecte sua carteira primeiro.");
            return;
        }

        try {
            setIsTransactionPending(true);

            // Fetch Token details
            const selectedToken = config?.selectedToken;
            if (!selectedToken) throw new Error("Token não configurado corretamente no rascunho.");

            const mintPubkey = new PublicKey(selectedToken.address || selectedToken.mint);
            // Detectar qual programa de token usar (SPL ou Token-2022)
            const tokenProgramId = await detectTokenProgram(connection, selectedToken.address || selectedToken.mint);


            // BUSCAR DECIMAIS REAIS DIRETO DA SOLANA (Production-ready)
            const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
            const realDecimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals;
            if (realDecimals === undefined) {
                throw new Error("Não foi possível validar os decimais do token na blockchain.");
            }

            const creatorPubkey = new PublicKey(publicKey);
            const senderTokenAccount = await getAssociatedTokenAddress(
                mintPubkey,
                creatorPubkey,
                false,
                tokenProgramId
            );

            // Fetch dynamic program ID based on network
            const currentProgramIdStr = PROGRAM_IDS[network] || PROGRAM_IDS['devnet'];
            const PROGRAM_ID = new PublicKey(currentProgramIdStr);

            // Configurar Anchor Provider e Program
            const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' });
            const program = new Program(IDL, PROGRAM_ID, provider);

            // Cria uma nova transação com todas as instruções de múltiplos destinatários
            const transaction = new Transaction();

            // Garantir que a ATA do remetente existe (Idempotent)
            transaction.add(
                createAssociatedTokenAccountIdempotentInstruction(
                    creatorPubkey,
                    senderTokenAccount,
                    creatorPubkey,
                    mintPubkey,
                    tokenProgramId
                )
            );

            // Setup de Tempos
            const startDateObj = parseVestingDate(config.vestingStartDate);
            if (!startDateObj) throw new Error("Data de início inválida.");
            const startTimestamp = Math.floor(startDateObj.getTime() / 1000);

            // Calcular o End Date em Ms
            const endDateObj = new Date(startDateObj.getTime());
            const duration = parseInt(config.vestingDuration || "0");
            const unit = config.selectedTimeUnit?.toLowerCase() || "";

            if (unit.includes('dia')) endDateObj.setDate(endDateObj.getDate() + duration);
            else if (unit.includes('mês') || unit.includes('mes')) endDateObj.setMonth(endDateObj.getMonth() + duration);
            else if (unit.includes('ano')) endDateObj.setFullYear(endDateObj.getFullYear() + duration);
            else if (unit.includes('hora')) endDateObj.setHours(endDateObj.getHours() + duration);
            else if (unit.includes('semana')) endDateObj.setDate(endDateObj.getDate() + (duration * 7));

            const endTimestamp = Math.floor(endDateObj.getTime() / 1000);

            let createdIds: string[] = [];

            // Preparar instruções para todos os destinatários
            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                const recipientPubkey = new PublicKey(recipient.walletAddress); // Changed from recipient.address to recipient.walletAddress to match original
                const contractIdValue = new BN(Date.now()).add(new BN(i));
                createdIds.push(contractIdValue.toString());

                // Calcular PDAs
                const [vestingContract] = PublicKey.findProgramAddressSync(
                    [Buffer.from("vesting"), creatorPubkey.toBuffer(), mintPubkey.toBuffer(), contractIdValue.toArrayLike(Buffer, "le", 8)],
                    PROGRAM_ID
                );

                const [escrowWallet] = PublicKey.findProgramAddressSync(
                    [Buffer.from("escrow"), vestingContract.toBuffer()],
                    PROGRAM_ID
                );

                // Converter valores (Usando decimais reais da rede)
                const totalAmountOnChain = new BN(Math.floor(parseFloat(recipient.amount.replace(',', '.')) * Math.pow(10, realDecimals)));

                // Determinar Tipo de Vesting
                let vestingType = { linear: {} };
                if (config.selectedSchedule === "cliff") {
                    const cliffDate = parseVestingDate(config.vestingStartDate);
                    const cliffTimestamp = new BN(Math.floor((cliffDate?.getTime() || Date.now()) / 1000));
                    const cliffPercentage = new BN(parseInt(config.cliffAmount || "0"));
                    vestingType = { cliff: [cliffTimestamp, cliffPercentage] } as any;
                }

                // Adicionar instrução CreateVesting
                const createVestingIx = await program.methods
                    .createVesting(
                        contractIdValue,
                        totalAmountOnChain,
                        new BN(startTimestamp), // Use startTimestamp from above
                        new BN(endTimestamp), // Use endTimestamp from above
                        vestingType as any
                    )
                    .accounts({
                        vestingContract,
                        creator: creatorPubkey,
                        beneficiary: recipientPubkey,
                        mint: mintPubkey,
                        escrowWallet,
                        senderTokenAccount,
                        systemProgram: SystemProgram.programId,
                        tokenProgram: tokenProgramId, // detectado dinamicamente — Interface<TokenInterface>
                    })
                    .instruction();

                transaction.add(createVestingIx);
            }

            // ✅ CHECK 4: Verificar saldo da ATA antes de enviar
            const senderAccountInfo = await connection.getTokenAccountBalance(senderTokenAccount);
            const senderBalance = new BN(senderAccountInfo.value.amount);
            const totalRequired = recipients.reduce((acc: BN, r: any) => {
                const amt = new BN(Math.floor(parseFloat(r.amount.replace(',', '.')) * Math.pow(10, realDecimals)));
                return acc.add(amt);
            }, new BN(0));
            console.log('[revisar] Saldo ATA creator:', senderBalance.toString(), '| Total necessário:', totalRequired.toString());
            if (senderBalance.lt(totalRequired)) {
                const hasFormatted = (senderBalance.toNumber() / Math.pow(10, realDecimals)).toFixed(realDecimals);
                const needFormatted = (totalRequired.toNumber() / Math.pow(10, realDecimals)).toFixed(realDecimals);
                throw new Error(`Saldo insuficiente: você tem ${hasFormatted} ${selectedToken.symbol}, mas precisa de ${needFormatted} ${selectedToken.symbol}.`);
            }

            // Assinatura e Envio real
            const { blockhash } = await connection.getLatestBlockhash('confirmed');
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = creatorPubkey;

            // 🧪 SIMULAÇÃO — revela erros reais antes de enviar
            const simulation = await connection.simulateTransaction(transaction);
            console.log('[revisar] simulação:', JSON.stringify(simulation, null, 2));
            if (simulation.value.err) {
                console.error('[revisar] ❌ Erro na simulação:', simulation.value.err);
                console.error('[revisar] Logs do programa:', simulation.value.logs);
                throw new Error(`Simulação falhou: ${JSON.stringify(simulation.value.err)}\n\nLogs:\n${simulation.value.logs?.join('\n')}`);
            }

            let signature = "";

            if (wallet.sendTransaction) {
                signature = await wallet.sendTransaction(transaction, connection);
            } else if (wallet.signAndSendTransaction) {
                const { signature: sig } = await wallet.signAndSendTransaction(transaction);
                signature = sig;
            } else {
                throw new Error("Carteira não suporta envio de transações.");
            }

            console.log("Transação on-chain enviada:", signature);
            await connection.confirmTransaction(signature, 'confirmed');

            alert("Contrato Vesting criado com sucesso na Solana!");

            // PDA do primeiro contrato (para retrocompatibilidade simples se necessário)
            const [contractPubkey] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from("vesting"),
                    creatorPubkey.toBuffer(),
                    mintPubkey.toBuffer(),
                    new BN(createdIds[0]).toArrayLike(Buffer, "le", 8)
                ],
                PROGRAM_ID
            );

            localStorage.setItem("created_contract_ids", JSON.stringify(createdIds));
            localStorage.setItem("last_vesting_signature", contractPubkey.toBase58());

            setIsVerificationModalOpen(false);
            router.push("/confirmar");

        } catch (error: any) {
            console.error("Transaction failed:", error);
            const msg = error.message || String(error);
            if (msg.includes("User rejected") || msg.includes("rejected the request") || msg.includes("denied transaction")) {
                alert("Transação cancelada pelo usuário.");
            } else {
                alert(`Falha na transação: ${msg}`);
            }
        } finally {
            setIsTransactionPending(false);
        }
    };

    const handleGoHome = () => {
        setIsWarningModalOpen(true);
    };

    const confirmGoHome = () => {
        localStorage.removeItem("contract_draft");
        localStorage.removeItem("recipients_draft");
        router.push("/home-cliente");
    };

    const formatAddress = (address: string) => {
        if (!address) return "";
        if (address.length <= 12) return address;
        return `${address.substring(0, 4)}...${address.substring(address.length - 8)}`;
    };

    const totalAmount = recipients.reduce((sum, r) => {
        const amt = typeof r.amount === 'string' ? r.amount.replace(',', '.') : r.amount;
        return sum + (parseFloat(amt) || 0);
    }, 0);
    // Format to avoid floating point issues and show up to 6 decimals
    const formattedTotal = Number(totalAmount.toFixed(6)).toString();
    const [currentTime, setCurrentTime] = useState("");

    React.useEffect(() => {
        const now = new Date();
        const formatted = now.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(',', '');
        setCurrentTime(formatted);
    }, []);

    const calculateEndDate = () => {
        if (!config?.vestingStartDate || !config?.vestingDuration || config.vestingStartDate === "dd/mm/yyyy, hh:mm") {
            return "Indefinida";
        }

        const startDate = parseVestingDate(config.vestingStartDate);
        if (!startDate) return "Indefinida";

        try {
            const date = new Date(startDate.getTime());
            const duration = parseInt(config.vestingDuration);
            const unit = config.selectedTimeUnit?.toLowerCase() || "";

            if (unit.includes('dia')) date.setDate(date.getDate() + duration);
            else if (unit.includes('mês') || unit.includes('mes')) date.setMonth(date.getMonth() + duration);
            else if (unit.includes('ano')) date.setFullYear(date.getFullYear() + duration);
            else if (unit.includes('hora')) date.setHours(date.getHours() + duration);
            else if (unit.includes('semana')) date.setDate(date.getDate() + (duration * 7));

            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).replace(',', '');
        } catch (e) {
            return "Indefinida";
        }
    };

    return (
        <div className="bg-black text-white min-h-screen flex flex-col font-sans overflow-x-hidden pb-32">
            {/* Header */}
            <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md bg-[#1A1A1A]/95 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-white/10 z-[60]">
                <div className="flex items-center space-x-1 text-[11px] font-medium text-zinc-400 overflow-x-auto scrollbar-hide">
                    <button onClick={handleGoHome} className="flex items-center hover:text-white transition-colors cursor-pointer">
                        <span className="material-icons-round text-lg">home</span>
                    </button>
                    <span className="material-icons-round text-sm opacity-50">chevron_right</span>
                    <Link href="/configuracao" className="hover:text-white whitespace-nowrap">Configuração</Link>
                    <span className="material-icons-round text-sm opacity-50">chevron_right</span>
                    <Link href="/destinatarios" className="hover:text-white whitespace-nowrap">Destinatários</Link>
                    <span className="material-icons-round text-sm opacity-50">chevron_right</span>
                    <span className="text-white font-bold whitespace-nowrap">Revisar</span>
                </div>
                <div className="flex items-center gap-3">
                    {isAdminUser && <NetworkSelector />}
                    <button
                        onClick={handleGoHome}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
                    >
                        <span className="material-icons-round text-lg text-white">close</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 w-full max-w-screen-md mx-auto px-5 pt-20 pb-6">
                <h1 className="text-3xl font-bold mb-6">Revisar</h1>

                {/* Warning Box */}
                {!config?.toggles?.cancelable && (
                    <div className="bg-[#1C1C1E] p-4 rounded-2xl flex items-start space-x-3 mb-8 border border-white/5">
                        <span className="material-icons-round text-yellow-500">warning</span>
                        <p className="text-[13px] leading-snug text-zinc-200">
                            Este contrato é imutável e não pode ser cancelado, mas pode ser transferido.
                        </p>
                    </div>
                )}

                {/* Chart Section */}
                <section className="mb-10">
                    <h2 className="text-lg font-bold mb-4">Detalhes do Contrato</h2>
                    <div className="pl-6 w-full">
                        <div className="relative w-full h-48 mb-8 border-l border-b border-zinc-700 flex items-end ml-2">
                            {/* Y-Axis Labels */}
                            <div className="absolute -left-8 h-full flex flex-col justify-between text-[10px] text-zinc-500 py-1 font-medium text-right w-6">
                                <span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span>
                            </div>

                            <div className="flex w-full h-full">
                                {/* 1. CLIFF GAP (Creation -> Start) */}
                                <div className="w-[14%] h-full relative flex flex-col justify-end">
                                    {/* Horizontal line at bottom */}
                                    <div className="absolute bottom-0 left-0 w-full h-px bg-[#C6963D]/50"></div>

                                    {/* Creation Date Label (Left aligned) */}
                                    <div className="absolute -bottom-8 left-0 -translate-x-1/3 text-[8px] text-zinc-500 text-center uppercase font-bold leading-tight whitespace-nowrap">
                                        {(() => {
                                            if (!currentTime) return null;
                                            const parts = currentTime.trim().split(/\s+/);
                                            const time = parts.length > 1 ? parts[parts.length - 1] : "";
                                            const date = parts.length > 0 ? parts[0] : "";
                                            return <>{time}<br />{date}</>;
                                        })()}
                                    </div>

                                    {/* Dashed Line (Right edge - Start of Vesting) */}
                                    <div className="absolute right-0 top-0 h-full border-r border-dashed border-[#C6963D]/50">
                                        <span className="absolute -top-4 -right-3 text-[9px] text-[#C6963D] font-bold text-center">CLIFF</span>
                                        <div className="absolute top-0 -right-[2.5px] w-1.5 h-1.5 bg-[#C6963D] rounded-full shadow-[0_0_8px_rgba(198,150,61,0.8)]"></div>
                                    </div>

                                    {/* Vesting Start Date Label (Right/Centered on line) */}
                                    <div className="absolute -bottom-8 right-0 translate-x-1/2 text-[8px] text-zinc-500 text-center uppercase font-bold leading-tight whitespace-nowrap">
                                        {(() => {
                                            const startDate = parseVestingDate(config?.vestingStartDate);
                                            if (!startDate) return null;

                                            const d = startDate.toLocaleDateString('pt-BR');
                                            const t = startDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                            return <>{t}<br />{d}</>;
                                        })()}
                                    </div>
                                </div>

                                {/* 2. VESTING BARS */}
                                <div className="flex-1 h-full flex items-end">
                                    {[1, 2, 3, 4, 5].map((step, index) => (
                                        <div key={index} className="flex-1 flex flex-col justify-end h-full group relative">
                                            <div
                                                className="w-full bg-gradient-to-t from-[#5C401D] to-[#C6963D] border-r border-black/20 hover:brightness-110 transition-all cursor-pointer"
                                                style={{ height: `${step * 20}%` }}
                                            ></div>

                                            {/* Tooltip on hover */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 text-white text-[10px] p-1 rounded whitespace-nowrap z-20 pointer-events-none">
                                                {step * 20}% liberado
                                            </div>

                                            {/* Date Label */}
                                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[8px] text-zinc-500 text-center uppercase font-bold leading-tight whitespace-nowrap">
                                                {(() => {
                                                    const date = parseVestingDate(config?.vestingStartDate);
                                                    if (!date) return <>{`MM/DD`}<br />{`HH:MM`}</>;
                                                    try {

                                                        const totalDuration = parseInt(config?.vestingDuration || "0");
                                                        const unit = config?.selectedTimeUnit?.toLowerCase() || "";

                                                        let multiplier = 0;
                                                        if (unit.includes('minuto')) multiplier = 60 * 1000;
                                                        else if (unit.includes('hora')) multiplier = 60 * 60 * 1000;
                                                        else if (unit.includes('dia')) multiplier = 24 * 60 * 60 * 1000;
                                                        else if (unit.includes('semana')) multiplier = 7 * 24 * 60 * 60 * 1000;
                                                        else if (unit.includes('mês') || unit.includes('mes')) multiplier = 30.44 * 24 * 60 * 60 * 1000;
                                                        else if (unit.includes('ano')) multiplier = 365.25 * 24 * 60 * 60 * 1000;

                                                        const totalDurationMs = totalDuration * multiplier;
                                                        const stepMs = totalDurationMs / 5;

                                                        date.setTime(date.getTime() + (stepMs * step)); // Use step (1-5)

                                                        const dateStr = date.toLocaleDateString('pt-BR', { month: '2-digit', day: '2-digit', year: 'numeric' });
                                                        const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                                        return <>{timeStr}<br />{dateStr}</>;
                                                    } catch {
                                                        return <>{`MM/DD`}<br />{`HH:MM`}</>;
                                                    }
                                                })()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Grid Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-8 gap-x-4 mt-12">
                        <DetailItem label="Vesting tipo" value="Linear" />
                        <DetailItem
                            label="Quantidade Total"
                            value={`${formattedTotal} ${config?.selectedToken?.symbol || ""}`}
                            icon={config?.selectedToken?.icon ? <img src={config.selectedToken.icon} className="w-4 h-4 rounded-full" /> : <span className="material-icons-round text-sm text-[#C6963D]">token</span>}
                        />
                        <DetailItem
                            label="Início data e hora"
                            value={currentTime}
                            showInfo
                            infoText="Data e hora exata em que este contrato foi criado e bloqueado na blockchain."
                        />
                        <DetailItem
                            label="Final data e hora"
                            value={calculateEndDate()}
                            showInfo
                            infoText="Data e hora prevista para o término do vesting, quando 100% dos tokens estarão liberados."
                        />
                        <DetailItem
                            label="Duração Vesting"
                            value={`${config?.vestingDuration || "0"} ${config?.selectedTimeUnit || ""}`}
                        />
                        <DetailItem label="Frequência de lançamento" value={config?.selectedSchedule || "Não definida"} />
                        <DetailItem
                            label="Início do Cliff"
                            value={config?.vestingStartDate || "Não definida"}
                            showInfo
                            infoText="Data e hora de início do período de vesting, a partir da qual os tokens começarão a ser contabilizados."
                        />
                        <DetailItem
                            label="Cliff Quantidade"
                            value={config?.cliffAmount ? `${config.cliffAmount}${config.cliffType === "PERCENTAGEM" ? "%" : ` ${config.selectedToken?.symbol}`}` : "0%"}
                        />
                        <DetailItem label="Número de destinatários" value={recipients.length.toString()} />
                        <DetailItem label="Quem pode alterar o destinatário" value={config?.selectedRecipientOption || "Somente o remetente"} fullWidth />
                        <DetailItem label="Auto-reveidicação" value={config?.toggles?.autoClaim ? "Habilitada" : "Desabilitada"} />
                        <DetailItem label="Quem pode cancelar o contrato" value={config?.toggles?.cancelable ? "Somente o remetente" : "Contrato Imutável"} fullWidth />
                    </div>
                </section>

                {/* Recipients Section */}
                <section className="mt-12">
                    <h2 className="text-lg font-bold mb-4">Destinatários</h2>
                    <div className="space-y-3">
                        {recipients.length === 0 ? (
                            <p className="text-zinc-500 text-sm italic">Nenhum destinatário adicionado.</p>
                        ) : (
                            recipients.map((recipient: any) => (
                                <div key={recipient.id} className="bg-[#1C1C1E] rounded-2xl p-4 flex items-center justify-between border border-white/5 shadow-inner">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded-full bg-[#8B5E1D] flex items-center justify-center p-0.5 overflow-hidden ring-1 ring-white/10">
                                            {config?.selectedToken?.icon ? (
                                                <img src={config.selectedToken.icon} className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <span className="material-icons-round text-white text-xl">token</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-lg leading-none">
                                                {recipient.amount} {config?.selectedToken?.symbol}
                                            </span>
                                            <span className="text-zinc-500 text-xs font-medium mt-1 uppercase">
                                                {formatAddress(recipient.walletAddress)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </main>

            {/* Footer */}
            <footer className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-md p-5 flex gap-4 bg-black/95 backdrop-blur-md z-50 border-t border-white/5">
                <Link
                    href="/destinatarios"
                    className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-2xl text-[16px] hover:bg-white/10 transition-colors flex items-center justify-center cursor-pointer active:scale-95"
                >
                    Voltar
                </Link>
                <button
                    onClick={() => setIsVerificationModalOpen(true)}
                    disabled={isTransactionPending}
                    className="flex-1 bg-gradient-to-r from-[#8B612E] to-[#5C401D] text-white font-bold py-4 rounded-2xl text-[16px] shadow-lg hover:opacity-90 transition-opacity flex items-center justify-center cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isTransactionPending ? 'Processando...' : 'Criar Vesting'}
                </button>
            </footer>

            <AddressVerificationModal
                isOpen={isVerificationModalOpen}
                onClose={() => !isTransactionPending && setIsVerificationModalOpen(false)}
                onConfirm={handleCreateContract}
                address={walletAddress}
            />

            <ExitWarningModal
                isOpen={isWarningModalOpen}
                onClose={() => setIsWarningModalOpen(false)}
                onConfirm={confirmGoHome}
            />
        </div>
    );
}

function DetailItem({ label, value, icon, showInfo, infoText, fullWidth }: { label: string, value: string, icon?: React.ReactNode, showInfo?: boolean, infoText?: string, fullWidth?: boolean }) {
    return (
        <div className={fullWidth ? "col-span-1" : ""}>
            <div className="flex items-center gap-1 mb-1 relative">
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tight">{label}</p>
                {showInfo && (
                    <div className="relative group flex items-center">
                        <span className="material-icons-round text-[12px] text-zinc-500 cursor-help hover:text-white transition-colors">info</span>
                        {infoText && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-[#2C2C2E] border border-white/10 text-zinc-200 text-[10px] rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center font-medium leading-snug">
                                {infoText}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#2C2C2E]"></div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2">
                {icon}
                <p className="text-[13px] font-bold text-white">{value}</p>
            </div>
        </div>
    );
}
