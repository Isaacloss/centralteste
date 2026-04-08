// 1. Configuração do Banco de Dados SQL (Dexie)
const db = new Dexie("PluviTech_Database");
db.version(1).stores({
    historico: '++id, dispositivo, acao, data'
});

// 2. Endereço IP do ESP32 (Ponte)
const ESP_IP = "http://192.168.4.1";

// 3. Função Principal de Comando
function executarAcao(disp, acao) {
   // const url = `http://192.168.4.1/comando?id=${disp}&val=${acao}`;
    const url = `${ESP_IP}/comando?id=${disp}&val=${acao}&t=${Math.random()}`;
    
    // Registra no SQL primeiro
    db.historico.add({
        dispositivo: disp,
        acao: acao,
        data: new Date().toLocaleString()
    }).then(() => atualizarInterface());

    // O truque: Criamos uma "Image" invisível para disparar o link.
    // Isso ignora erros de CORS e de resposta do navegador.
    const img = new Image();
    img.src = url; 
    
    console.log("Comando disparado!");
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