export const metadata = {
  title: "Termos de Uso | OmniZap Anime Radar",
  description:
    "Condições de uso do portal e da API do OmniZap Anime Radar.",
};

const LAST_UPDATED = "15 de março de 2026";

export default function TermosPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 animate-fade-in">
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-rose-500" />
          <h1 className="!text-4xl md:!text-5xl">Termos de Uso</h1>
        </div>
        <p className="lead text-slate-300">
          Regras para acesso ao portal, consumo da API e uso do conteúdo agregado.
        </p>
        <p className="text-sm text-slate-500">Última atualização: {LAST_UPDATED}</p>
      </section>

      <section className="info-card flex flex-col gap-6">
        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">1. Aceitação dos termos</h2>
          <p className="text-sm text-slate-400">
            Ao usar este site ou a API, você concorda com estes termos e com a política de privacidade vigente.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">2. Natureza do serviço</h2>
          <p className="text-sm text-slate-400">
            O OmniZap é um agregador e monitor de notícias. Os links e referências apontam para fontes originais,
            que permanecem responsáveis por seu próprio conteúdo editorial.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">3. Uso permitido</h2>
          <p className="text-sm text-slate-400">
            É permitido consultar páginas e consumir endpoints de forma legítima. Não é permitido uso abusivo,
            scraping agressivo, tentativa de indisponibilizar o serviço ou violação de segurança.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">4. Propriedade intelectual</h2>
          <p className="text-sm text-slate-400">
            Títulos, marcas e conteúdos de terceiros pertencem aos respectivos proprietários. Sempre que aplicável,
            mantenha atribuição e link para a fonte original.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">5. Disponibilidade e mudanças</h2>
          <p className="text-sm text-slate-400">
            O serviço pode sofrer mudanças de estrutura, endpoints, layout ou regras operacionais sem aviso prévio.
            Também pode haver indisponibilidade temporária por manutenção ou falhas externas.
          </p>
        </article>

        <article className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-slate-100">6. Limitação de responsabilidade</h2>
          <p className="text-sm text-slate-400">
            O serviço é fornecido no estado em que se encontra, sem garantia de continuidade, precisão absoluta ou
            adequação a objetivo específico.
          </p>
        </article>
      </section>
    </div>
  );
}
