const express = require('express');
// Usando a versão furtiva do Puppeteer
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Ativando o disfarce para passar pelos bloqueios
puppeteer.use(StealthPlugin());

const app = express();
app.use(express.json());

app.post('/api/precos', async (req, res) => {
    const { url, loja } = req.body;

    if (!url || !loja) {
        return res.status(400).json({ erro: 'Envie a url e a loja.' });
    }

    console.log(`🔎 Buscando preço na ${loja}...`);

    try {
        // Abre o navegador em segundo plano
        // Abre o navegador em segundo plano
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // 1. FORÇA O TAMANHO DA TELA PARA DESKTOP (FULL HD)
        await page.setViewport({ width: 1920, height: 1080 });
        
        // 2. Disfarça o robô para parecer um navegador normal
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Aguarda 3 segundos para garantir que os preços carregaram via JavaScript
        await new Promise(r => setTimeout(r, 3000)); 
        // Tira um print da tela e salva na mesma pasta do script
        await page.screenshot({ path: 'kabum_debug.png' })

        let dados = { preco: null, metodo_pagamento: null };

        // Lógica específica para ler a página da Kabum
        // Lógica específica para ler a página da Kabum (Versão Inteligente)
        if (loja.toLowerCase() === 'kabum') {
            dados = await page.evaluate(() => {
                // 1. Pega todos os elementos de título <h4> da página
                const h4s = Array.from(document.querySelectorAll('h4'));
                
                // 2. Procura qual deles contém a palavra "R$" no texto
                const elementoPreco = h4s.find(h4 => h4.innerText.includes('R$'));
                
                if (elementoPreco) {
                    let precoTexto = elementoPreco.innerText;
                    // Limpa o texto "R$ 409,99" para virar um número matemático "409.99"
                    let precoLimpo = precoTexto.replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
                    return {
                        preco: parseFloat(precoLimpo),
                        metodo_pagamento: 'PIX'
                    };
                }
                return { preco: null, metodo_pagamento: null };
            });
        } // ... (código da kabum termina aqui)
        else if (loja.toLowerCase() === 'mercadolivre' || loja.toLowerCase() === 'mercado livre') {
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));
            
            // Nova lógica de extração do Mercado Livre
            dados = await page.evaluate(() => {
                // 1. Procura a linha principal do preço (ignora o preço antigo riscado, se houver)
                const containerPreco = document.querySelector('.ui-pdp-price__second-line');
                
                if (containerPreco) {
                    // 2. Pega os reais e os centavos separados
                    const reais = containerPreco.querySelector('.andes-money-amount__fraction')?.innerText.replace(/\./g, '') || '0';
                    const centavos = containerPreco.querySelector('.andes-money-amount__cents')?.innerText || '00';
                    
                    // 3. Junta tudo com um ponto (ex: 79.90) e converte para número
                    const precoFinal = parseFloat(`${reais}.${centavos}`);
                    
                    return {
                        preco: precoFinal,
                        metodo_pagamento: 'Mercado Pago / PIX'
                    };
                }
                
                return { preco: null, metodo_pagamento: null };
            });

        } // ... (código do Mercado Livre termina aqui)
         else if (loja.toLowerCase() === 'amazon') {
            
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await new Promise(r => setTimeout(r, 3000));
            
            // Nova lógica de extração da Amazon
            dados = await page.evaluate(() => {
                // 1. Procura o elemento dos reais
                const reaisElement = document.querySelector('.a-price-whole');
                
                if (reaisElement) {
                    // Pega o texto (ex: "175," ou "1.200,"), remove os pontos e a vírgula
                    let reais = reaisElement.innerText.replace(/,/g, '').replace(/\./g, '').trim();
                    
                    // Tenta achar os centavos, se não achar, assume que é "00"
                    const centavosElement = document.querySelector('.a-price-fraction');
                    let centavos = centavosElement ? centavosElement.innerText.trim() : '00';
                    
                    // Junta tudo no formato matemático
                    const precoFinal = parseFloat(`${reais}.${centavos}`);
                    
                    return {
                        preco: precoFinal,
                        metodo_pagamento: 'Amazon / Cartão'
                    };
                }
                
                return { preco: null, metodo_pagamento: null };
            });} // ... (código da Amazon termina aqui)
        else {
            dados = { erro: "Loja ainda não configurada no script." };
        }
        await browser.close();
        console.log(`✅ Preço encontrado: R$ ${dados.preco}`);
        
        // Devolve o resultado pro n8n
        res.json(dados);

    } catch (error) {
        console.error("❌ Erro ao acessar o site:", error.message);
        res.status(500).json({ erro: 'Falha ao processar a página' });
    }
});

// Inicia o servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Motor de Scraping rodando em http://localhost:${PORT}`);
});