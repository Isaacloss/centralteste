// 1. Configuração do Banco de Dados SQL (Dexie)
const db = new Dexie("PluviTech_Database");
db.version(1).stores({
    historico: '++id, dispositivo, acao, data'
});

// 2. Configurações de UUID do Bluetooth (Iguais ao código do ESP32)
const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

let dispositivoBLE;
let caracteristicaBLE;

// 3. Função para Conectar ao Bluetooth
async function conectarBluetooth() {
    const btn = document.getElementById('btn-conectar');
    const statusTxt = document.getElementById('status');

    try {
        console.log("Buscando dispositivo...");
        dispositivoBLE = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'PluviTech_BLE' }],
            optionalServices: [SERVICE_UUID]
        });

        statusTxt.innerText = "Status: Conectando...";
        
        const server = await dispositivoBLE.gatt.connect();
        const service = await server.getPrimaryService(SERVICE_UUID);
        caracteristicaBLE = await service.getCharacteristic(CHARACTERISTIC_UUID);
        
        statusTxt.innerText = "Status: Conectado via Bluetooth";
        statusTxt.style.color = "#2ecc71";
        btn.innerText = "DISPOSITIVO PAREADO";
        btn.style.backgroundColor = "#27ae60";

        // Monitor de desconexão
        dispositivoBLE.addEventListener('gattserverdisconnected', () => {
            statusTxt.innerText = "Status: Desconectado";
            statusTxt.style.color = "#e74c3c";
            btn.innerText = "CONECTAR BLUETOOTH";
            btn.style.backgroundColor = "#3498db";
        });

    } catch (error) {
        console.error("Erro Bluetooth:", error);
        statusTxt.innerText = "Status: Falha na conexão";
        alert("Erro: " + error.message);
    }
}

// 4. Função para Enviar Comando e Gravar no SQL
async function executarAcao(disp, acao) {
    const comando = `${disp}:${acao}`;

    if (!caracteristicaBLE) {
        alert("Primeiro conecte o Bluetooth!");
        return;
    }

    try {
        // Envio via Bluetooth
        const encoder = new TextEncoder();
        await caracteristicaBLE.writeValue(encoder.encode(comando));

        // Grava no Banco de Dados Local (SQL)
        await db.historico.add({
            dispositivo: disp,
            acao: acao,
            data: new Date().toLocaleString()
        });

        console.log("Comando enviado: " + comando);
        atualizarInterface();

    } catch (error) {
        console.error("Erro ao enviar:", error);
        alert("Erro ao enviar comando. Verifique a conexão.");
    }
}

// 5. Atualiza a lista na tela