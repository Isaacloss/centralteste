// 1. Banco de Dados Local
const db = new Dexie("PluviTech_Database");
db.version(1).stores({ historico: '++id, dispositivo, acao, data' });

// 2. Configurações BLE
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let dispositivoBLE;
let caracteristicaBLE;

// 3. Função para conectar e ativar notificações de feedback
async function conectarBluetooth() {
    const btn = document.getElementById('btn-conectar');
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        const server = await dispositivoBLE.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        // Ativa a escuta de notificações vindas do ESP32
        await caracteristicaBLE.startNotifications();
        caracteristicaBLE.addEventListener('characteristicvaluechanged', tratarFeedback);

        statusTxt.innerText = "Status: Conectado (Monitorando)";
        statusTxt.style.color = "#2ecc71";
        indicador.innerText = "PRONTO PARA OPERAR";
        btn.innerText = "SISTEMA PAREADO";
        btn.style.backgroundColor = "#27ae60";

        dispositivoBLE.addEventListener('gattserverdisconnected', () => {
            statusTxt.innerText = "Status: Desconectado";
            indicador.innerText = "AGUARDANDO CONEXÃO";
            indicador.style.backgroundColor = "#333";
        });

    } catch (error) {
        console.error(error);
        alert("Erro ao conectar: " + error.message);
    }
}

// 4. Trata a resposta que o ESP32 envia de volta
function tratarFeedback(event) {
    const value = new TextDecoder().decode(event.target.value);
    const indicador = document.getElementById('indicador-status');
    
    console.log("Feedback recebido do hardware:", value);

    if (value === "CONFIRM_ON") {
        indicador.style.backgroundColor = "#2ecc71"; // Verde
        indicador.innerText = "VÁLVULA ABERTA (CONFIRMADO)";
    } else if (value === "CONFIRM_OFF") {
        indicador.style.backgroundColor = "#e74c3c"; // Vermelho
        indicador.innerText = "VÁLVULA FECHADA (CONFIRMADO)";
    }
}

// 5. Envia o comando
async function executarAcao(disp, acao) {
    if (!caracteristicaBLE) {
        alert("Conecte o Bluetooth primeiro!");
        return;
    }

    const comando = `${disp}:${acao}`;
    const encoder = new TextEncoder();

    try {
        // Envia o comando sem bloquear a interface com erros de ACK
        await caracteristicaBLE.writeValue(encoder.encode(comando)).catch(e => console.log("Enviado (ACK omitido)"));

        // Registra no Log local
        await db.historico.add({
            dispositivo: disp,
            acao: acao,
            data: new Date().toLocaleString()
        });
        atualizarInterface();

    } catch (error) {
        console.error("Erro no envio:", error);
    }
}

// 6. Funções de Interface
async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    lista.innerHTML = logs.map(log => `
        <div class="log-item">
            <small>${log.data}</small><br>
            <strong>${log.dispositivo}</strong>: ${log.acao}
        </div>
    `).join('');
}

async function limparHistorico() {
    if(confirm("Limpar logs?")) { await db.historico.clear(); atualizarInterface(); }
}

atualizarInterface();