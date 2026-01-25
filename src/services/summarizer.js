require("dotenv").config();
const OpenAI = require("openai");
const axios = require("axios");
const cheerio = require("cheerio");
const logger = require("../utils/logger.js");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractArticleText(htmlContent) {
  const $ = cheerio.load(htmlContent);
  const articleText = $(".entry-content").text();
  return articleText.trim();
}

/**
 * Gera um resumo a partir de um conteúdo HTML usando a API do Gemini.
 * @param {string} htmlContent - O conteúdo HTML da página da notícia.
 * @returns {Promise<string>} O resumo da notícia.
 */

// Fila para garantir processamento sequencial das requisições à IA
let iaQueue = Promise.resolve();

function summarizeHtml(htmlContent) {
  if (!process.env.OPENAI_API_KEY) {
    return Promise.reject(
      new Error("A variável de ambiente OPENAI_API_KEY não foi definida.")
    );
  }

  // Adiciona a requisição à fila
  iaQueue = iaQueue.then(async () => {
    try {
      const articleText = extractArticleText(htmlContent);

      if (!articleText) {
        logger.warn(
          "[Resumo] Não foi possível extrair o texto do artigo para resumir."
        );
        return "Não foi possível extrair o conteúdo para resumo.";
      }

      // Tenta extrair o título da notícia (primeira linha do texto ou heurística)
      let titulo =
        articleText.split("\n").find((l) => l.trim().length > 0) ||
        "[Sem título detectado]";
      if (titulo.length > 120) titulo = titulo.slice(0, 500) + "...";
      logger.info(`\n========== ENVIANDO PARA IA ==========`);
      logger.info(`Título: ${titulo}`);
      logger.info(`======================================\n`);

      const prompt = `Resuma a seguinte notícia. Use alguns emojis apropriados no texto do resumo, sem exagerar.
Destaque o anúncio principal (como data, estúdio, lançamento, etc.), 
explique brevemente o contexto para melhor entendimento 
e acrescente um comentário curto sobre a relevância ou possível impacto do anúncio:\n\n"${articleText}"`;

      const response = await client.responses.create({
        model: "gpt-5-nano-2025-08-07",
        input: prompt,
      });
      const summary = (response.output_text || "").trim();

      if (!summary) {
        logger.warn("[Resumo] A IA não retornou texto para o resumo.");
        return "Não foi possível gerar o resumo.";
      }

      logger.info("\n========== RESPOSTA DA IA ============");
      logger.info(summary);
      logger.info("======================================\n");
      logger.success("[Resumo] Resumo recebido.");
      return summary;
    } catch (error) {
      logger.error("[Resumo] Erro ao gerar resumo:", error.message);
      return "Ocorreu um erro durante o resumo.";
    }
  });

  // Retorna uma promise que resolve quando a requisição for processada
  return iaQueue;
}

async function summarizeUrl(url) {
  if (!url) {
    throw new Error("URL inválida para resumo.");
  }

  logger.info(`[Resumo] Buscando conteúdo para: ${url}`);

  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    },
  });

  return summarizeHtml(response.data);
}

module.exports = { summarizeHtml, summarizeUrl };
