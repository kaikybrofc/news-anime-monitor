export const metadata = {
  title: "Política de Privacidade | OmniZap Anime Radar",
  description:
    "Saiba como o OmniZap trata dados de navegação, uso da plataforma e informações técnicas.",
};

const LAST_UPDATED = "15 de março de 2026";

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
            Podemos registrar dados técnicos de acesso, como IP, agente do navegador, horário de requisição e endpoint consumido. Esses dados são usados para segurança, observabilidade e estabilidade do serviço.
          </p>
        </article>

        <article>
          <h2>2. Uso das informações</h2>
          <p>
            As informações coletadas ajudam no monitoramento operacional, prevenção de abuso, diagnóstico de erros e melhoria de performance das páginas e da API.
          </p>
        </article>

        <article>
          <h2>3. Cookies e tecnologias similares</h2>
          <p>
            O site pode utilizar cookies técnicos essenciais para funcionamento e métricas de navegação. Não vendemos dados pessoais e não utilizamos rastreamento invasivo para publicidade comportamental.
          </p>
        </article>

        <article>
          <h2>4. Compartilhamento</h2>
          <p>
            Não compartilhamos dados pessoais com terceiros para fins comerciais. Dados técnicos podem ser processados por infraestrutura de hospedagem, monitoramento e segurança.
          </p>
        </article>

        <article>
          <h2>5. Retenção e segurança</h2>
          <p>
            Mantemos registros pelo tempo necessário para operação, auditoria e prevenção de incidentes. Aplicamos medidas razoáveis de segurança para proteger os dados armazenados.
          </p>
        </article>

        <article>
          <h2>6. Contato sobre privacidade</h2>
          <p>
            Em caso de dúvidas sobre esta política, utilize a página de contato do projeto para solicitar suporte.
          </p>
        </article>
      </section>
    </div>
  );
}
