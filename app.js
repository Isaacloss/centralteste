// 1. Configuração do Banco de Dados SQL (Dexie)
const db = new Dexie("PluviTech_Database");
db.version(1).stores({
    historico: '++id, dispositivo, acao, data'
});

// 2. Endereço IP do ESP32 (Ponte)
const ESP_IP = "http://192.168.4.1";

// 3. Função Principal de Comando
function executarAcao(disp, acao) {
    // Adicionamos um número aleatório (t) para o navegador não cachear
    const url = `http://192.168.4.1/comando?id=${disp}&val=${acao}&t=${Date.now()}`;
    
    console.log("Disparando comando...");

    // MÉTODO DA IMAGEM: O navegador dispara a requisição sem checar se tem internet
    // É o jeito mais estável para redes locais sem gateway de saída
    const img = new Image();
    
    img.onload = () => console.log("Comando entregue!");
    img.onerror = () => console.log("Comando enviado (ignorado erro de resposta)");
    
    img.src = url; 

    // Salva no SQL normalmente
    db.historico.add({
        dispositivo: disp,
        acao: acao,
        data: new Date().toLocaleString()
    }).then(() => atualizarInterface());
}

// 4. Função para atualizar a lista na tela (Lendo do SQL)
async function atualizarInterface() {
    const lista = document.getElementById('lista-logs');
    if (!lista) return;

    // Busca os últimos 10 registros no banco SQL
    const logs = await db.historico.orderBy('id').reverse().limit(10).toArray();
    
    lista.innerHTML = logs.map(log => `
        <div class="log-item">
            <small>${log.data}</small> | <b>${log.dispositivo}</b>: ${log.acao}
        </div>
    `).join('');
}

// Inicializa a tela ao abrir o app
atualizarInterface();