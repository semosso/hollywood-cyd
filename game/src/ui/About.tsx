import type { Lang } from "../engine/types";

/** Rascunho da página "Sobre". Pendente: logo oficial do TMDB (baixar do kit de marca em themoviedb.org/about/logos-attribution). */
export function About({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const pt = lang === "pt";
  return (
    <div className="swipe reveal" role="dialog" aria-label={pt ? "Sobre o jogo" : "About the game"}>
      <div className="eyebrow">{pt ? "Sobre" : "About"}</div>
      <h2>{pt ? "Agradeço à Academia" : "I'd Like to Thank the Academy"}</h2>
      <p style={{ margin: 0 }}>
        {pt
          ? "Um simulador de carreira em Hollywood. Você cria um ator ou atriz, distribui pontos entre cinco atributos e, ao longo de 20 a 40 decisões, escolhe às cegas entre filmes e pessoas reais, descritos sem nome. Só depois de escolher o jogo revela o que era. No fim, uma tela diz como sua carreira terminou."
          : "A Hollywood career simulator. You create an actor, spend points across five attributes and, over 25 decisions, choose blind between real films and real people, described without names. Only after you choose does the game reveal what it was. At the end, a card says how your career ended."}
      </p>
      <div>
        <div className="eyebrow">{pt ? "Como funciona" : "How it works"}</div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>{pt ? "Os filmes, diretores, bilheterias, críticas e prêmios são reais. O que acontece com você dentro deles é sorteado a partir do seu Talento, da exigência do papel e de um pouco de sorte." : "Films, directors, box office, reviews and awards are real. What happens to you inside them is rolled from your Talent, the role's demands and a bit of luck."}</li>
          <li>{pt ? "Cada atributo revela um tipo de informação antes da escolha. Quem gasta tudo em Beleza joga no escuro." : "Each attribute reveals a kind of information before you choose. Spend everything on Looks and you play blind."}</li>
          <li>{pt ? "Fatos sobre pessoas reais entram como fatos. Rumores entram marcados como rumor, e alguns são falsos de propósito." : "Facts about real people appear as facts. Rumors appear tagged as rumors, and some are deliberately false."}</li>
          <li>{pt ? "Vício, sexo e crime acontecem com personagens inventados, em circunstâncias copiadas de casos famosos. A resolução diz com quem aconteceu de verdade." : "Addiction, sex and crime happen with invented characters, in circumstances copied from famous cases. The resolution tells you who it really happened to."}</li>
          <li>{pt ? "Com baixa probabilidade, um evento pessoal vira uma guinada: um impulso que traz um diretor de peso até você, ou uma queda em que só sobra o que ninguém quis." : "With low probability, a personal event becomes a swing: a boost that brings a major director to you, or a slump where only leftovers remain."}</li>
          <li>{pt ? "Mesma seed, mesmas ofertas. Compartilhe a seed para desafiar alguém a viver a mesma vida; compartilhe o link completo para mostrar a sua." : "Same seed, same offers. Share the seed to challenge someone to live the same life; share the full link to show yours."}</li>
        </ul>
      </div>
      <div>
        <div className="eyebrow">{pt ? "Dados e atribuição" : "Data and attribution"}</div>
        <p style={{ margin: "6px 0 0" }}>
          {pt ? "Dados de filmes, elenco, equipe, bilheteria e pôsteres: " : "Film, cast, crew, box office and poster data: "}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">The Movie Database (TMDB)</a>.
          {" "}{pt ? "Este produto usa a API do TMDB mas não é endossado nem certificado pelo TMDB." : "This product uses the TMDB API but is not endorsed or certified by TMDB."}
          {" "}{pt ? "Crítica: " : "Reviews: "}<a href="https://www.omdbapi.com" target="_blank" rel="noreferrer">OMDb API</a>.
          {" "}{pt ? "Prêmios: " : "Awards: "}<a href="https://www.wikidata.org" target="_blank" rel="noreferrer">Wikidata</a>.
          {" "}{pt ? "Pôsteres e imagens pertencem aos respectivos estúdios." : "Posters and images belong to their studios."}
          {" "}{pt ? "Visitas contadas com " : "Visits counted with "}<a href="https://www.goatcounter.com" target="_blank" rel="noreferrer">GoatCounter</a>{pt ? ", sem cookies e sem identificar ninguém." : ", without cookies and without identifying anyone."}
        </p>
        <div className="mono muted" style={{ marginTop: 8 }}>[ logo TMDB aqui ]</div>
      </div>
      <div>
        <div className="eyebrow">{pt ? "Aviso" : "Disclaimer"}</div>
        <p style={{ margin: "6px 0 0" }}>
          {pt
            ? "Projeto feito por fã, sem fins comerciais. Sátira sobre a indústria do cinema. Não é afiliado a nenhum estúdio, pessoa, premiação ou organização citada. Pessoas reais aparecem por fatos públicos de obra e de carreira; eventos de vício, crime e vida pessoal são ficção com personagens inventados. Se algo estiver errado, abra uma issue no repositório."
            : "Fan-made, non-commercial project. Satire about the film industry. Not affiliated with any studio, person, award or organization mentioned. Real people appear through public facts about their work and careers; addiction, crime and personal-life events are fiction with invented characters. If something is wrong, open an issue in the repository."}
        </p>
      </div>
      <div>
        <div className="eyebrow">{pt ? "Código e licença" : "Code and license"}</div>
        <p style={{ margin: "6px 0 0" }}>
          <a href="https://github.com/semosso/hollywood-cyd" target="_blank" rel="noreferrer">github.com/semosso/hollywood-cyd</a>.
          {" "}{pt ? "Endereço principal: " : "Main address: "}<a href="https://thank-the-academy.vnazambuja.workers.dev/">thank-the-academy.vnazambuja.workers.dev</a>.
          {" "}{pt ? "Código sob MIT. Textos do jogo sob CC BY-NC-SA 4.0." : "Code under MIT. Game texts under CC BY-NC-SA 4.0."}
        </p>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>{pt ? "Se você precisar conversar com alguém: CVV 188 (Brasil) · 988 (EUA)." : "If you need to talk to someone: 988 (US) · CVV 188 (Brazil)."}</p>
      <button className="primary" onClick={onClose}>{pt ? "Voltar" : "Back"}</button>
    </div>
  );
}
