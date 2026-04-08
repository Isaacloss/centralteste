/**
 * PLUVITECH CENTRAL V5.1 - ALTA DISPONIBILIDADE
 */

const db = new Dexie("PluviTech_Database");
db.version(1).stores({ historico: '++id, dispositivo, acao, data' });

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let dispositivoBLE = null;
let caracteristicaBLE = null;

// Tenta reconectar assim que a página carregar (se já houve pareamento antes)
window.onload = () => {
    atualizarInterface();
    // Verifica se o navegador suporta "getDevices" (disponível em versões recentes do Chrome)
    if (navigator.bluetooth.getDevices) {
        navigator.bluetooth.getDevices().then(devices => {
            if (devices.length > 0) {
                console.log("Dispositivo conhecido encontrado. Tentando reconexão silenciosa...");
                dispositivoBLE = devices[0];
                configurarServico(dispositivoBLE);
            }
        });
    }
};

async function conectarBluetooth() {
    try {
        // Se já temos o objeto, apenas conecta
        if (dispositivoBLE) {
            await configurarServico(dispositivoBLE);
            return;
        }

        // Se é a primeira vez, pede permissão
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        dispositivoBLE.addEventListener('gattserverdisconnected', onDisconnected);
        await configurarServico(dispositivoBLE);

    } catch (error) {
        console.log("Erro: " + error);
    }
}

async function configurarServico(device) {
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        if (!device.gatt.connected) {
            await device.gatt.connect();
        }
        
        const service = await device.gatt.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        await caracteristicaBLE.startNotifications();
        caracteristicaBLE.addEventListener('characteristicvaluechanged', tratarFeedback);

        statusTxt.innerText = "Status: Conectado";
        statusTxt.style.color = "#2ecc71";
        indicador.innerText = "SISTEMA PRONTO";
        indicador.style.backgroundColor = "#333";
    } catch (err) {
        console.error("Falha ao configurar:", err);
        // Tenta novamente em 5 segundos se falhar
        setTimeout(() => configurarServico(device), 5000);
    }
}

function onDisconnected() {
    document.getElementById('status').innerText = "Status: Reconectando...";
    document.getElementById('status').style.color = "orange";
    
    // Tenta reconectar infinitamente a cada 3 segundos
    setTimeout(() => {
        if (dispositivoBLE) {
            configurarServico(dispositivoBLE);
        }
    }, 3000);
}

function tratarFeedback(event) {
    const value = new TextDecoder().decode(event.target.value);
    const indicador = document.getElementById('indicador-status');
    if (value === "CONFIRM_ON") {
        indicador.style.backgroundColor = "#2ecc71";
        indicador.innerText = "VÁLVULA ABERTA (CONFIRMADO)";
    } else if (value === "CONFIRM_OFF") {
        indicador.style.backgroundColor = "#e74c3c";
        indicador.innerText = "VÁLVULA FECHADA (CONFIRMADO)";
    }
}

async function executarAcao(disp, acao) {
    if (!caracteristicaBLE) return;
    const encoder = new TextEncoder();
    try {
        await caracteristicaBLE.writeValue(encoder.encode(`${disp}:${acao}`))
            .catch(e => console.log("Enviado via buffer"));
        
        await db.historico.add({ dispositivo: disp, acao: acao, data: new Date().toLocaleString() });
        atualizarInterface();
    } catch (e) { console.error(e); }
}

async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    lista.innerHTML = logs.map(log => `
        <div class="log-item"><small>${log.data}</small><br><strong>${log.dispositivo}</strong>: ${log.acao}</div>
    `).join('');
}

async function limparHistorico() { if(confirm("Limpar?")) { await db.historico.clear(); atualizarInterface(); } }