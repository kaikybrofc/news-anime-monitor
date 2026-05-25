export const metadata = {
  title: "Política de Privacidade | OmniZap Anime Radar",
  description:
    "Saiba como o OmniZap trata dados de navegação, uso da plataforma e informações técnicas.",
};

const LAST_UPDATED = "25 de maio de 2026";

export default function PrivacidadePage() {
  return (
    <div className="page-shell mx-auto max-w-5xl animate-fade-in">
      <section className="page-intro">
        <div className="section-heading">
          <span className="page-kicker">Privacidade</span>
          <h1>Política de Privacidade</h1>
          <p className="lead">Esta política explica como tratamos informações de uso no portal e na API.</p>
          <p className="text-sm text-[var(--muted)]">Última atualização: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="legal-shell legal-prose">
        <article>
          <h2>1. Dados coletados</h2>
          <p>
            Podemos coletar dados técnicos e de uso, incluindo IP, data e hora, endpoint acessado, status da requisição, agente de navegador/dispositivo, origem de tráfego,
            identificadores técnicos de sessão, parâmetros operacionais e métricas de desempenho. A coleta é limitada ao necessário para operação, segurança e evolução do serviço.
          </p>
        </article>

        <article>
          <h2>2. Finalidades e base legal</h2>
          <p>
            Os dados são tratados para: (i) operar e disponibilizar o portal e a API; (ii) prevenir abuso, fraude e incidentes de segurança; (iii) diagnosticar erros e melhorar desempenho;
            (iv) cumprir obrigações legais e regulatórias. Quando aplicável, o tratamento se fundamenta em execução de serviço, legítimo interesse, exercício regular de direitos e
            cumprimento de obrigação legal, nos termos da legislação aplicável, incluindo a LGPD.
          </p>
        </article>

        <article>
          <h2>3. Cookies e tecnologias similares</h2>
          <p>
            O site pode usar cookies e armazenamento local para funções essenciais, segurança, preferências e medição técnica de uso. Não realizamos venda de dados pessoais
            e não usamos rastreamento invasivo para publicidade comportamental de terceiros.
          </p>
        </article>

        <article>
          <h2>4. Compartilhamento</h2>
          <p>
            Não comercializamos dados pessoais. O tratamento pode envolver operadores e provedores de infraestrutura (hospedagem, CDN, monitoramento, segurança e banco de dados),
            estritamente para execução técnica do serviço, sob obrigações contratuais e medidas de proteção adequadas.
          </p>
        </article>

        <article>
          <h2>5. Retenção e segurança</h2>
          <p>
            Mantemos registros pelo período necessário para finalidades legítimas de operação, auditoria, prevenção de incidentes e defesa em processos administrativos, arbitrais ou judiciais.
            Aplicamos medidas técnicas e organizacionais razoáveis de segurança, mas nenhum ambiente é totalmente imune a riscos.
          </p>
        </article>

        <article>
          <h2>6. Direitos do titular</h2>
          <p>
            Nos termos da legislação aplicável, especialmente a LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação quando cabível,
            portabilidade, informação sobre compartilhamento e revisão de decisões automatizadas, observadas limitações legais e segredos comercial e industrial.
          </p>
        </article>

        <article>
          <h2>7. Transferência internacional</h2>
          <p>
            Parte da infraestrutura pode operar fora do seu país. Nesses casos, adotamos medidas contratuais e técnicas compatíveis com proteção adequada de dados,
            conforme exigências legais aplicáveis.
          </p>
        </article>

        <article>
          <h2>8. Menores de idade</h2>
          <p>
            O serviço não é direcionado intencionalmente a menores sem a devida supervisão legal. Se houver tratamento indevido envolvendo menor, solicitamos contato imediato para avaliação
            e providências cabíveis.
          </p>
        </article>

        <article>
          <h2>9. Alterações desta política</h2>
          <p>
            Esta política pode ser atualizada periodicamente para refletir ajustes legais, técnicos e operacionais. A versão vigente será sempre a publicada nesta página com a data de revisão.
          </p>
        </article>

        <article>
          <h2>10. Contato e exercício de direitos</h2>
          <p>
            Para dúvidas, exercício de direitos, solicitações relacionadas a dados pessoais ou notificações legais, utilize a página de contato oficial do projeto,
            informando claramente o pedido e dados mínimos para validação.
          </p>
        </article>
      </section>
    </div>
  );
}
