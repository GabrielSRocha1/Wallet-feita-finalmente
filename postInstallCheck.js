const fs = require('fs');
const { execSync } = require('child_process');

function log(msg) {
    console.log(`[CHECK] ${msg}`);
}

// 1. Verificar se gill está em package.json
function checkPackageJson() {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    let hasGill = false;

    if (pkg.dependencies) {
        if (pkg.dependencies.gill) {
            log('Gill encontrado no package.json ✅');
            hasGill = true;
        }
        if (pkg.dependencies['@solana/kit']) {
            log('@solana/kit encontrado no package.json ✅');
            hasGill = true;
        }
    }

    if (!hasGill) {
        log('Gill não encontrado. Instalando automaticamente...');
        try {
            execSync('npm install gill', { stdio: 'inherit' });
            log('Gill instalado com sucesso ✅');
        } catch (err) {
            log('Erro ao instalar Gill, tentando @solana/kit...');
            try {
                execSync('npm install @solana/kit', { stdio: 'inherit' });
                log('@solana/kit instalado com sucesso ✅');
            } catch (e) {
                log('Falha na instalação de fallback ❌');
            }
        }
    }
}

// 2. Testar importação
function testImport() {
    try {
        require('gill');
        log('Importação de Gill OK ✅');
    } catch (err) {
        log('Erro na importação de Gill. Tentando @solana/kit...');
        try {
            require('@solana/kit');
            log('Importação de @solana/kit OK ✅');
        } catch (err2) {
            log('Falha na importação de ambas bibliotecas ❌');
            // console.error(err2); // Opcional
        }
    }
}

// 3. Verificar conflito com @solana/web3.js antigo
function checkWeb3Conflict() {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const web3Version = pkg.dependencies && pkg.dependencies['@solana/web3.js'];

    if (web3Version) {
        log(`@solana/web3.js encontrado: ${web3Version}`);
        // Simples check de versão, assumindo ^1.x.x ou similar
        const majorMatch = web3Version.match(/(\d+)\./);
        const major = majorMatch ? parseInt(majorMatch[1], 10) : 0;

        // Se for < 1 ou se não conseguir parsear (ex: 'latest'), tenta garantir
        // Nota: web3.js v1 é o estável clássico. v2 está em alpha/beta.
        if (major < 1 && web3Version !== 'latest') {
            log('Versão antiga detectada ou não identificada. Atualizando para ^1.0.0...');
            execSync('npm install @solana/web3.js@^1.0.0', { stdio: 'inherit' });
        } else {
            log('Versão do web3.js parece OK ✅');
        }
    } else {
        log('@solana/web3.js não encontrado. Instalando versão estável...');
        execSync('npm install @solana/web3.js@^1.0.0', { stdio: 'inherit' });
    }
}

// 4. Testar conexão Devnet
async function testConnection() {
    try {
        const { Connection, clusterApiUrl } = require('@solana/web3.js');
        console.log('[CHECK] Conectando a Devnet...');
        const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
        const version = await conn.getVersion();
        log(`Conexão Devnet OK ✅ Versão Solana Core: ${version['solana-core']}`);
    } catch (err) {
        log('Erro na conexão com Devnet ❌');
        console.error(err.message);
    }
}

// Rodar tudo
async function runChecks() {
    console.log('--- INICIANDO VERIFICAÇÃO PÓS-INSTALAÇÃO ---');
    checkPackageJson();
    testImport();
    try {
        checkWeb3Conflict();
    } catch (e) {
        console.error('Erro ao verificar web3:', e.message);
    }
    await testConnection();
    console.log('--- FIM DA VERIFICAÇÃO ---');
}

runChecks();
