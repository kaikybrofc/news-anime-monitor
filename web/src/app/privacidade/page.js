export const metadata = {
  title: "Política de Privacidade | OmniZap Anime Radar",
  description:
    "Saiba como o OmniZap trata dados de navegação, uso da plataforma e informações técnicas.",
};

const LAST_UPDATED = "15 de março de 2026";

export default function PrivacidadePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl md:!text-5xl">Política de Privacidade</h1>
        </div>
        <p className="lead text-slate-300">
          Esta política explica como tratamos informações de uso no portal e na API.
        </p>
        <p className="text-sm text-slate-500">Última atualização: {LAST_UPDATED}</p>
      </section>

      <section className="info-card flex flex-col gap-6">
        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">1. Dados coletados</h2>
          <p className="text-sm text-slate-400">
            Podemos registrar dados técnicos de acesso, como IP, agente do navegador, horário de requisição e
            endpoint consumido. Esses dados são usados para segurança, observabilidade e estabilidade do serviço.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">2. Uso das informações</h2>
          <p className="text-sm text-slate-400">
            As informações coletadas ajudam no monitoramento operacional, prevenção de abuso, diagnóstico de erros e
            melhoria de performance das páginas e da API.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">3. Cookies e tecnologias similares</h2>
          <p className="text-sm text-slate-400">
            O site pode utilizar cookies técnicos essenciais para funcionamento e métricas de navegação. Não vendemos
            dados pessoais e não utilizamos rastreamento invasivo para publicidade comportamental.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">4. Compartilhamento</h2>
          <p className="text-sm text-slate-400">
            Não compartilhamos dados pessoais com terceiros para fins comerciais. Dados técnicos podem ser processados
            por infraestrutura de hospedagem, monitoramento e segurança.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">5. Retenção e segurança</h2>
          <p className="text-sm text-slate-400">
            Mantemos registros pelo tempo necessário para operação, auditoria e prevenção de incidentes. Aplicamos
            medidas razoáveis de segurança para proteger os dados armazenados.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">6. Contato sobre privacidade</h2>
          <p className="text-sm text-slate-400">
            Em caso de dúvidas sobre esta política, utilize a página de contato do projeto para solicitar suporte.
          </p>
        </article>
      </section>
    </div>
  );
}
