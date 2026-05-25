import { PageKicker } from "@/components/page-kicker";
export const metadata = {
  title: "Termos de Uso | OmniZap Anime Radar",
  description:
    "Condições de uso do portal e da API do OmniZap Anime Radar.",
};

const LAST_UPDATED = "25 de maio de 2026";

export default function TermosPage() {
  return (
    <div className="page-shell mx-auto max-w-5xl animate-fade-in">
      <section className="page-intro">
        <div className="section-heading">
          <PageKicker>Condições de uso</PageKicker>
          <h1>Termos de Uso</h1>
          <p className="lead">Regras para acesso ao portal, consumo da API e uso do conteúdo agregado.</p>
          <p className="text-sm text-[var(--muted)]">Última atualização: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="legal-shell legal-prose">
        <article>
          <h2>1. Aceitação dos termos</h2>
          <p>
            Ao acessar o portal ou consumir a API, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso e com a Política de Privacidade vigente.
            Se não concordar com qualquer condição, não utilize o serviço.
          </p>
        </article>

        <article>
          <h2>2. Natureza do serviço</h2>
          <p>
            O OmniZap é um agregador e monitor de notícias com finalidade informativa e técnica. O conteúdo editorial original, imagens, marcas e declarações de terceiros pertencem
            exclusivamente aos respectivos titulares, que são os únicos responsáveis por seus materiais.
          </p>
        </article>

        <article>
          <h2>3. Uso permitido</h2>
          <p>
            É permitido consultar páginas e endpoints de forma legítima e proporcional. É proibido: uso abusivo, automação agressiva, scraping em volume incompatível com operação normal,
            tentativas de indisponibilização, bypass de autenticação, engenharia reversa maliciosa, exploração de falhas, envio de carga anormal e qualquer prática que viole legislação aplicável.
          </p>
        </article>

        <article>
          <h2>4. Limites de API e medidas técnicas</h2>
          <p>
            Para proteção do ambiente, a API pode aplicar rate limit, cache, bloqueio temporário, bloqueio permanente, desafios técnicos e outras salvaguardas sem aviso prévio.
            O operador pode negar, restringir ou encerrar acesso sempre que identificar risco operacional, abuso ou descumprimento destes termos.
          </p>
        </article>

        <article>
          <h2>5. Propriedade intelectual</h2>
          <p>
            Títulos, marcas, layout, código e componentes do serviço são protegidos por legislação aplicável. Conteúdos de terceiros permanecem sob titularidade de seus proprietários.
            Sempre que aplicável, preserve atribuição e link para a fonte original.
          </p>
        </article>

        <article>
          <h2>6. Disponibilidade e mudanças</h2>
          <p>
            O serviço pode sofrer mudanças de estrutura, endpoints, layout, funcionalidades e regras operacionais a qualquer tempo, sem aviso prévio. Também podem ocorrer indisponibilidades
            por manutenção, atualizações, falhas de terceiros, eventos de segurança e casos fortuitos.
          </p>
        </article>

        <article>
          <h2>7. Isenção de garantias</h2>
          <p>
            O serviço é fornecido no estado em que se encontra e conforme disponibilidade, sem garantias expressas ou implícitas de continuidade, precisão absoluta, não interrupção,
            adequação a finalidade específica, atualização em tempo real ou ausência de erro.
          </p>
        </article>

        <article>
          <h2>8. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida pela lei, o OmniZap e seus responsáveis não respondem por danos indiretos, lucros cessantes, perda de chance, perda de dados, danos reputacionais
            ou decisões tomadas com base nas informações exibidas. A responsabilidade total, quando legalmente aplicável, fica limitada ao menor valor permitido pela legislação.
          </p>
        </article>

        <article>
          <h2>9. Responsabilidade do usuário e indenização</h2>
          <p>
            Você é responsável por seu uso do serviço e se compromete a indenizar, defender e manter indene o OmniZap e seus responsáveis contra reclamações, custos, despesas, danos,
            perdas e honorários decorrentes de uso indevido, violação destes termos ou infração de direitos de terceiros.
          </p>
        </article>

        <article>
          <h2>10. Notificações e remoção de conteúdo referenciado</h2>
          <p>
            Solicitações de correção, remoção de referência, alegações de violação e notificações legais devem ser enviadas pelos canais oficiais da página de contato,
            com identificação do solicitante e fundamento objetivo. Pedidos incompletos podem ser recusados até regularização.
          </p>
        </article>

        <article>
          <h2>11. Legislação aplicável e foro</h2>
          <p>
            Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do operador do serviço, com renúncia a qualquer outro,
            por mais privilegiado que seja, salvo hipótese de competência legal obrigatória.
          </p>
        </article>
      </section>
    </div>
  );
}
