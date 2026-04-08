// 1. Configuração do Banco de Dados SQL (Dexie)
const db = new Dexie("PluviTech_Database");
db.version(1).stores({
    historico: '++id, dispositivo, acao, data'
});

// 2. Endereço IP do ESP32 (Ponte)
const ESP_IP = "http://192.168.4.1";

// 3. Função Principal de Comando
async function executarAcao(disp, acao) {
    console.log(`Tentando: ${disp} -> ${acao}`);
    
    // Montamos a URL exatamente como testamos no navegador
    const urlConstruida = `${ESP_IP}/comando?id=${disp}&val=${acao}`;

    try {
        // O segredo está aqui: o fetch envia o comando e segue em frente
        // Usamos 'no-cors' para o navegador não travar a requisição por segurança
        fetch(urlConstruida, { 
            mode: 'no-cors',
            cache: 'no-cache' 
        });

        // Salva no SQL interno do celular (persistência)
        await db.historico.add({
            dispositivo: disp,
            acao: acao,
            data: new Date().toLocaleString()
        });

        console.log("Comando processado localmente e enviado ao ESP32.");
        atualizarInterface();

    } catch (error) {
        console.error("Erro na comunicação:", error);
    }
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