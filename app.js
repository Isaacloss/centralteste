/**
 * PLUVITECH CENTRAL V5 - Arquivo JavaScript Completo
 * Funcionalidades: Bluetooth BLE, Reconexão Automática, Feedback em Tempo Real e SQL Local.
 */

// 1. Configuração do Banco de Dados Local (Dexie.js)
const db = new Dexie("PluviTech_Database");
db.version(1).stores({
    historico: '++id, dispositivo, acao, data'
});

// 2. Configurações de UUID (Devem ser idênticas às do ESP32)
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

// 3. Variáveis de Controle de Estado
let dispositivoBLE = null;
let caracteristicaBLE = null;
let autoReconnect = true; // Ativa a tentativa de reconexão automática

// 4. Função Principal de Conexão
async function conectarBluetooth() {
    const btn = document.getElementById('btn-conectar');
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        // Se já existe um objeto de dispositivo mas está desconectado, tenta reconectar diretamente
        if (dispositivoBLE && !dispositivoBLE.gatt.connected) {
            console.log("Tentando reconectar ao dispositivo conhecido...");
            await dispositivoBLE.gatt.connect();
            await configurarServico(dispositivoBLE);
            return;
        }

        // Se não há dispositivo na memória, solicita ao usuário (Segurança do Chrome)
        console.log("Solicitando permissão para parear...");
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        // Ouvinte para quedas de conexão
        dispositivoBLE.addEventListener('gattserverdisconnected', onDisconnected);

        await configurarServico(dispositivoBLE);

    } catch (error) {
        console.error("Erro na conexão Bluetooth:", error);
        statusTxt.innerText = "Status: Falha ao conectar";
        statusTxt.style.color = "#e74c3c";
    }
}

// 5. Configura o Serviço e a Característica após conectar
async function configurarServico(device) {
    const btn = document.getElementById('btn-conectar');
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        // Ativa notificações para receber feedback (CONFIRM_ON / CONFIRM_OFF)
        await caracteristicaBLE.startNotifications();
        caracteristicaBLE.addEventListener('characteristicvaluechanged', tratarFeedback);

        // Atualiza Interface para sucesso
        statusTxt.innerText = "Status: Conectado (Monitorando)";
        statusTxt.style.color = "#2ecc71";
        indicador.innerText = "PRONTO PARA OPERAR";
        indicador.style.backgroundColor = "#333";
        btn.innerText = "SISTEMA PAREADO";
        btn.style.backgroundColor = "#27ae60";

    } catch (err) {
        console.error("Erro ao configurar serviço:", err);
    }
}

// 6. Lógica de Reconexão Automática
function onDisconnected() {
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');
    const btn = document.getElementById('btn-conectar');

    statusTxt.innerText = "Status: Conexão perdida. Reconectando...";
    statusTxt.style.color = "#f39c12";
    indicador.innerText = "RECONECTANDO...";
    indicador.style.backgroundColor = "#444";
    btn.innerText = "BUSCANDO HARDWARE...";
    btn.style.backgroundColor = "#d35400";

    if (autoReconnect) {
        // Tenta reconectar a cada 5 segundos sem abrir a caixa de diálogo
        setTimeout(() => {
            if (dispositivoBLE && !dispositivoBLE.gatt.connected) {
                conectarBluetooth();
            }
        }, 5000);
    }
}

// 7. Trata os dados recebidos do ESP32 (Feedback)
function tratarFeedback(event) {
    const value = new TextDecoder().decode(event.target.value);
    const indicador = document.getElementById('indicador-status');
    
    console.log("Feedback do Hardware:", value);

    if (value === "CONFIRM_ON") {
        indicador.style.backgroundColor = "#2ecc71";
        indicador.innerText = "VÁLVULA ABERTA (CONFIRMADO)";
    } else if (value === "CONFIRM_OFF") {
        indicador.style.backgroundColor = "#e74c3c";
        indicador.innerText = "VÁLVULA FECHADA (CONFIRMADO)";
    }
}

// 8. Envia o comando para o ESP32
async function executarAcao(disp, acao) {
    if (!caracteristicaBLE) {
        alert("Bluetooth não conectado!");
        return;
    }

    const comando = `${disp}:${acao}`;
    const encoder = new TextEncoder();

    try {
        // writeValue envia o comando. O catch silencia erros de confirmação do Chrome
        await caracteristicaBLE.writeValue(encoder.encode(comando))
            .catch(e => console.log("Comando enviado (Confirmação pendente)"));

        // Grava no histórico local SQL
        await db.historico.add({
            dispositivo: disp,
            acao: acao,
            data: new Date().toLocaleString()
        });

        atualizarInterface();

    } catch (error) {
        console.error("Erro no envio do comando:", error);
    }
}

// 9. Atualiza a lista de logs na tela
async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    if (!lista) return;

    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    
    if (logs.length === 0) {
        lista.innerHTML = '<p style="color:#444; text-align:center; margin-top:60px;">Sem registros.</p>';
        return;
    }

    lista.innerHTML = logs.map(log => `
        <div class="log-item">
            <small>${log.data}</small><br>
            <strong>${log.dispositivo}</strong>: ${log.acao}
        </div>
    `).join('');
}

// 10. Limpa o histórico
async function limparHistorico() {
    if (confirm("Deseja apagar todos os registros locais?")) {
        await db.historico.clear();
        atualizarInterface();
    }
}

// Inicializa a interface ao carregar
atualizarInterface();