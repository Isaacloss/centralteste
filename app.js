// Endereço IP do ESP32 (Ponte)  
const ESP_IP = "http://192.168.4.1";

// Função Principal de Comando
function executarAcao(disp, acao) {
    console.log("=== INICIANDO COMANDO ===");
    console.log(`[1] Dispositivo: ${disp}`);
    console.log(`[2] Ação: ${acao}`);
    console.log(`[3] Timestamp: ${Date.now()}`);
    
    // Adicionamos um número aleatório (t) para o navegador não cachear
    const url = `http://192.168.4.1/comando?id=${disp}&val=${acao}&t=${Date.now()}`;
    console.log(`[4] URL Completa: ${url}`);
    
    console.log(`[5] Enviando requisição com fetch (no-cors)...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.log(`[TIMEOUT] Requisição demorou mais de 5 segundos!`);
        controller.abort();
    }, 5000);

    fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        console.log(`[6] RESPOSTA RECEBIDA`);
        console.log(`[7] Status: ${response.status}`);
        console.log(`[8] Status Text: ${response.statusText}`);
        console.log(`[9] Type: ${response.type}`);
        console.log(`✓ Comando entregue com sucesso!`);
    })
    .catch(error => {
        clearTimeout(timeoutId);
        console.error(`[ERRO] Falha na requisição:`);
        console.error(`[ERROR] Nome: ${error.name}`);
        console.error(`[ERROR] Mensagem: ${error.message}`);
        console.error(`[ERROR] Stack:`, error.stack);
        
        if (error.name === 'AbortError') {
            console.log(`→ Abortado (timeout ou cancelamento manual)`);
        } else {
            console.log(`→ Erro de rede/CORS`);
        }
    });
}