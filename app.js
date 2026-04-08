/**
 * PLUVITECH V9 - PWA EDITION (AUTO-RECONNECT)
 */
const db = new Dexie("PluviTech_Database");
db.version(1).stores({ historico: '++id, dispositivo, acao, data' });

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let dispositivoBLE = null;
let caracteristicaBLE = null;

// Tenta reconectar assim que o PWA abre
window.onload = async () => {
    atualizarInterface();
    verificarPareamentoPrevio();
};

// No PWA, o navegador permite checar dispositivos já autorizados
async function verificarPareamentoPrevio() {
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
        try {
            const devices = await navigator.bluetooth.getDevices();
            const jaPareado = devices.find(d => d.name === 'PluviTech_BLE');
            if (jaPareado) {
                console.log("Hardware conhecido encontrado. Conectando...");
                await configurarServico(jaPareado);
            }
        } catch (e) { console.log("Aguardando ação do usuário."); }
    }
}

async function conectarBluetooth() {
    try {
        // Se já temos o objeto (mesmo desconectado), tenta ligar o GATT
        if (dispositivoBLE) {
            await configurarServico(dispositivoBLE);
            return;
        }

        // Abre a lista (Apenas na primeira vez no PWA)
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        dispositivoBLE.addEventListener('gattserverdisconnected', onDisconnected);
        await configurarServico(dispositivoBLE);

    } catch (error) {
        alert("Ative GPS e Bluetooth.");
    }
}

async function configurarServico(device) {
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        statusTxt.innerText = "Status: Conectando...";
        if (!device.gatt.connected) await device.gatt.connect();
        
        const service = await device.gatt.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        await caracteristicaBLE.startNotifications();
        caracteristicaBLE.addEventListener('characteristicvaluechanged', (e) => {
            const val = new TextDecoder().decode(e.target.value);
            if (val === "CONFIRM_ON") {
                indicador.style.backgroundColor = "#2ecc71";
                indicador.innerText = "VÁLVULA ABERTA (OK)";
            } else if (val === "CONFIRM_OFF") {
                indicador.style.backgroundColor = "#e74c3c";
                indicador.innerText = "VÁLVULA FECHADA (OK)";
            }
        });

        statusTxt.innerText = "Status: Online (PWA)";
        statusTxt.style.color = "#2ecc71";
        indicador.innerText = "SISTEMA PRONTO";
        indicador.style.backgroundColor = "#333";
        dispositivoBLE = device; // Salva na memória global

    } catch (err) {
        console.error(err);
        setTimeout(() => configurarServico(device), 5000);
    }
}

function onDisconnected() {
    document.getElementById('status').innerText = "Status: Offline. Reconectando...";
    document.getElementById('status').style.color = "orange";
    setTimeout(() => { if (dispositivoBLE) configurarServico(dispositivoBLE); }, 5000);
}

async function executarAcao(disp, acao) {
    if (!caracteristicaBLE) {
        conectarBluetooth(); // Tenta conectar se clicar e estiver off
        return;
    }
    try {
        const encoder = new TextEncoder();
        await caracteristicaBLE.writeValue(encoder.encode(`${disp}:${acao}`))
            .catch(() => console.log("Enviado"));
        
        await db.historico.add({ dispositivo: disp, acao: acao, data: new Date().toLocaleString() });
        atualizarInterface();
    } catch (e) { console.error(e); }
}

async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    if(!lista) return;
    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    lista.innerHTML = logs.map(log => `
        <div class="log-item"><small>${log.data}</small><br><strong>${log.dispositivo}</strong>: ${log.acao}</div>
    `).join('');
}

async function limparHistorico() { if(confirm("Limpar?")) { await db.historico.clear(); atualizarInterface(); } }