/**
 * PLUVITECH V8 - ALTA DISPONIBILIDADE & AUTO-RECONNECT
 */
const db = new Dexie("PluviTech_Database");
db.version(1).stores({ historico: '++id, dispositivo, acao, data' });

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let dispositivoBLE = null;
let caracteristicaBLE = null;

// 1. Tenta reconectar ao carregar a página
window.onload = async () => {
    atualizarInterface();
    tentarResgatarDispositivo();
};

// 2. Tenta pegar o dispositivo que já foi pareado uma vez
async function tentarResgatarDispositivo() {
    if (navigator.bluetooth && navigator.bluetooth.getDevices) {
        try {
            const devices = await navigator.bluetooth.getDevices();
            dispositivoBLE = devices.find(d => d.name === 'PluviTech_BLE');
            
            if (dispositivoBLE) {
                console.log("Hardware reconhecido encontrado. Tentando link automático...");
                await configurarServico(dispositivoBLE);
            }
        } catch (err) {
            console.log("Aguardando interação para reconectar...");
        }
    }
}

// 3. Função de conexão (Manual ou Automática)
async function conectarBluetooth() {
    const statusTxt = document.getElementById('status');
    
    try {
        // Se já conhecemos o hardware, não abre a lista, apenas conecta
        if (dispositivoBLE) {
            await configurarServico(dispositivoBLE);
            return;
        }

        // Se é a primeira vez, pede permissão (Obrigatório pelo Android)
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        dispositivoBLE.addEventListener('gattserverdisconnected', onDisconnected);
        await configurarServico(dispositivoBLE);

    } catch (error) {
        console.error(error);
        alert("Certifique-se que o Bluetooth e GPS estão ativos.");
    }
}

async function configurarServico(device) {
    const statusTxt = document.getElementById('status');
    const indicador = document.getElementById('indicador-status');

    try {
        if (!device.gatt.connected) {
            await device.gatt.connect();
        }
        
        const server = device.gatt;
        const service = await server.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        await caracteristicaBLE.startNotifications();
        caracteristicaBLE.addEventListener('characteristicvaluechanged', tratarFeedback);

        statusTxt.innerText = "Status: Online (Conectado)";
        statusTxt.style.color = "#2ecc71";
        indicador.innerText = "SISTEMA PRONTO";
        indicador.style.backgroundColor = "#333";
    } catch (err) {
        console.error("Falha ao subir serviço:", err);
        // Tenta de novo em 3 segundos
        setTimeout(() => configurarServico(device), 3000);
    }
}

// 4. Lógica de "App de Lâmpada": Não desiste nunca
function onDisconnected() {
    const statusTxt = document.getElementById('status');
    statusTxt.innerText = "Status: Hardware Offline. Buscando...";
    statusTxt.style.color = "#e67e22";

    // Tenta reconectar automaticamente sem intervenção humana
    setTimeout(() => {
        if (dispositivoBLE) {
            console.log("Reconectando automaticamente...");
            configurarServico(dispositivoBLE);
        }
    }, 5000);
}

function tratarFeedback(event) {
    const value = new TextDecoder().decode(event.target.value);
    const indicador = document.getElementById('indicador-status');
    if (value === "CONFIRM_ON") {
        indicador.style.backgroundColor = "#2ecc71";
        indicador.innerText = "VÁLVULA ABERTA (OK)";
    } else if (value === "CONFIRM_OFF") {
        indicador.style.backgroundColor = "#e74c3c";
        indicador.innerText = "VÁLVULA FECHADA (OK)";
    }
}

async function executarAcao(disp, acao) {
    if (!caracteristicaBLE) {
        // Se clicou e estava desconectado, tenta o reconectar rápido
        conectarBluetooth();
        return;
    }
    try {
        await caracteristicaBLE.writeValue(new TextEncoder().encode(`${disp}:${acao}`));
        await db.historico.add({ dispositivo: disp, acao: acao, data: new Date().toLocaleString() });
        atualizarInterface();
    } catch (e) { console.log("Erro no envio"); }
}

async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    if(!lista) return;
    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    lista.innerHTML = logs.map(log => `
        <div class="log-item"><small>${log.data}</small><br><strong>${log.dispositivo}</strong>: ${log.acao}</div>
    `).join('');
}

async function limparHistorico() { if(confirm("Limpar registros?")) { await db.historico.clear(); atualizarInterface(); } }