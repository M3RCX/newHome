import heroImg from "../assets/hero.jpg";
import { site } from "../content";
import { daysLeft } from "../lib/format";

export default function Hero() {
  const n = daysLeft(site.eventDate);
  const before = n != null && n > 0;

  return (
    <>
      <div className="top">
        <span className="eyebrow">Save the date</span>
        <span className="eyebrow">{site.couple}</span>
      </div>
      <header className="hero">
        <div>
          <div className="kicker">
            <span className="spark" />
            &nbsp; {site.kicker}
          </div>
          <h1>{site.title}</h1>
          <div className="bigdate">{site.bigDate}</div>
          <p className="lede">{site.intro}</p>
          <ul className="facts">
            <li>
              <span>Quando</span>
              {site.date}
            </li>
            <li>
              <span>Hora</span>
              {site.time}
            </li>
            <li>
              <span>Onde</span>
              {site.place}
            </li>
          </ul>
        </div>
        <figure className="illo">
          <img
            src={heroImg}
            alt="Ilustração do Lasanha, um filhote preto, deitado dentro de uma taça de champanhe segurando uma garrafinha"
          />
          <svg className="curve" viewBox="0 0 200 200" aria-hidden="true">
            <path id="arc" d="M30,20 A150,150 0 0 0 150,180" fill="none" />
            <text>
              <textPath href="#arc">Lasanha convida</textPath>
            </text>
          </svg>
          <div className="keytag" aria-label="Contagem regressiva">
            <div className="k-label">{before ? "faltam" : n === 0 ? "é hoje" : "foi"}</div>
            <div className="k-num">{before ? n : n === 0 ? "!" : "♥"}</div>
            <div className="k-sub">{before ? (n === 1 ? "dia" : "dias") : ""}</div>
          </div>
        </figure>
      </header>
    </>
  );
}
