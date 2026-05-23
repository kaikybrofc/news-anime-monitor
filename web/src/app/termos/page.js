export const metadata = {
  title: "Termos de Uso | OmniZap Anime Radar",
  description:
    "Condições de uso do portal e da API do OmniZap Anime Radar.",
};

const LAST_UPDATED = "15 de março de 2026";

export default function TermosPage() {
  return (
    <div className="page-shell mx-auto max-w-5xl animate-fade-in">
      <section className="page-intro">
        <div className="section-heading">
          <span className="page-kicker">Condições de uso</span>
          <h1>Termos de Uso</h1>
          <p className="lead">Regras para acesso ao portal, consumo da API e uso do conteúdo agregado.</p>
          <p className="text-sm text-[var(--muted)]">Última atualização: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="legal-shell legal-prose">
        <article>
          <h2>1. Aceitação dos termos</h2>
          <p>Ao usar este site ou a API, você concorda com estes termos e com a política de privacidade vigente.</p>
        </article>

        <article>
          <h2>2. Natureza do serviço</h2>
          <p>
            O OmniZap é um agregador e monitor de notícias. Os links e referências apontam para fontes originais, que permanecem responsáveis por seu próprio conteúdo editorial.
          </p>
        </article>

        <article>
          <h2>3. Uso permitido</h2>
          <p>
            É permitido consultar páginas e consumir endpoints de forma legítima. Não é permitido uso abusivo, scraping agressivo, tentativa de indisponibilizar o serviço ou violação de segurança.
          </p>
        </article>

        <article>
          <h2>4. Propriedade intelectual</h2>
          <p>
            Títulos, marcas e conteúdos de terceiros pertencem aos respectivos proprietários. Sempre que aplicável, mantenha atribuição e link para a fonte original.
          </p>
        </article>

        <article>
          <h2>5. Disponibilidade e mudanças</h2>
          <p>
            O serviço pode sofrer mudanças de estrutura, endpoints, layout ou regras operacionais sem aviso prévio. Também pode haver indisponibilidade temporária por manutenção ou falhas externas.
          </p>
        </article>

        <article>
          <h2>6. Limitação de responsabilidade</h2>
          <p>
            O serviço é fornecido no estado em que se encontra, sem garantia de continuidade, precisão absoluta ou adequação a objetivo específico.
          </p>
        </article>
      </section>
    </div>
  );
}
