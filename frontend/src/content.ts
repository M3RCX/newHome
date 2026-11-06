// Conteúdo fixo do site (antes ficava no JSON do design). Edite aqui e faça deploy.
import type { PixConfig } from "./lib/pix";

export type Chapter = {
  date: string;
  title: string;
  text: string;
  gallery?: GalleryKey;
  key?: boolean; // capítulo da chave: data em destaque e o guindaste some
  minor?: boolean; // data pequena ao lado do andar
};

export type GalleryKey = "obra" | "familia";
export type Photo = { src: string; caption?: string };

export const site = {
  couple: "Letícia, Gui e Lasanha",
  title: "A casa nova da Letícia e do Gui",
  kicker: "Chá de casa nova + aniversário da Lele",
  intro:
    "Depois de 3 anos, 5 meses e 30 dias de espera, a chave chegou. No sábado, 19 de dezembro, vamos abrir as portas do apê pela primeira vez pra quem fez parte dessa história, comemorar o meu aniversário e apresentar o Lasanha pra quem ainda não conhece. Vem com a gente!",
  bigDate: "19.12",
  eventDate: "2026-12-19",
  date: "19 de dezembro, sábado",
  time: "Horário a confirmar",
  place: "Nosso apê novo (endereço em breve)",
  giftNote:
    "Presente não é obrigatório, de verdade. Obrigatória mesmo é a sua presença (essa a gente cobra). Mas, se quiser mimar a casa nova, montamos uma lista bem pensada: dá pra levar no dia ou mandar por Pix.",
};

// Pix e WhatsApp: preencha para o copia e cola e o botão do WhatsApp aparecerem no site.
export const pix: PixConfig = {
  key: "32384714813", // telefone no formato +5511999999999, e-mail, CPF ou chave aleatória
  name: "guilherme mercante remberg fernandes", // nome do titular, como aparece no app do banco
  city: "são paulo", // cidade do titular
};
export const whatsapp: string = ""; // com DDD, ex.: "+55 11 99999-9999"

// Itens a partir deste valor aceitam "ajudar com uma parte" (mesma regra da API).
export const PARTE_MIN_CENTS = 60000;

export const chapters: Chapter[] = [
  {
    date: "26 de março de 2023",
    title: "O dia do stand",
    text: "Fui e voltei naquele stand não sei quantas vezes. Olhava a planta, fazia conta, desistia, voltava atrás. A dúvida era do tamanho do apartamento.\n\nMeus pais estavam lá comigo, como sempre, e seguiram do meu lado em todos os dias depois, inclusive nos difíceis. No fim daquele domingo, eu assinei. Pai, mãe: essa casa também é de vocês. 🤍",
  },
  {
    date: "No meio do caminho",
    title: "Uma cantada boba",
    minor: true,
    text: "Eu achava que estava comprando a minha independência: morar sozinha, do meu jeito. A vida tinha outros planos.\n\nNa fase mais bagunçada da minha vida, chegou uma mensagem do Gui com uma cantada boba. Nem liguei. Mas a conversa foi pegando ritmo, e quando vi eu já estava esperando o celular vibrar.",
  },
  {
    date: "18 de setembro e 2 de novembro de 2024",
    title: "O beijo e o namoro",
    minor: true,
    text: "Depois de tanta conversa, veio o primeiro beijo e, com ele, uma calma que eu não sentia havia muito tempo. Pouco mais de um mês depois, o pedido de namoro. Sem eu perceber, o plano de morar sozinha virou o plano de morar com ele.",
  },
  {
    date: "3 de novembro de 2025",
    title: "O pedido de noivado",
    minor: true,
    text: "Um ano e um dia depois, já morando juntos, veio o pedido de noivado. Parece rápido, mas com o Gui nunca pareceu pressa. Pareceu reencontro, como se a gente já se conhecesse de outras vidas.",
  },
  {
    date: "3 anos, 5 meses e 30 dias",
    title: "A espera",
    gallery: "obra",
    text: 'Enquanto a nossa história andava rápido, a obra andava no ritmo dela: visitas e mais visitas, o prédio subindo andar por andar e um "falta pouco" que nunca chegava.',
  },
  {
    date: "25 de setembro de 2026, 9h",
    title: "A chave",
    key: true,
    text: "Numa sexta-feira de setembro, às 9h, a chave veio parar na minha mão. ✨ O apê estava vazio, só paredes e eco. Mesmo assim, no primeiro passo lá dentro, eu me senti em casa. Todo o perrengue valeu a pena.",
  },
  {
    date: "Agora",
    title: "Hoje, uma família",
    gallery: "familia",
    text: "Gui, obrigada por ter chegado bem na hora em que eu mais precisava, mesmo eu achando que não era a hora certa. Era. Você era.\n\nHoje a gente é uma família: eu, o Gui e o Lasanha, aqui no 7º andar. 🐶 E queremos você com a gente no dia 19 pra conhecer o apê, conhecer o Lasanha e brindar o meu aniversário.",
  },
];

// Fotos das galerias: coloque os arquivos em frontend/public/photos/ e liste aqui.
// Ex.: { src: "/photos/obra-1.jpg", caption: "a primeira visita" }
export const galleries: Record<GalleryKey, Photo[]> = {
  obra: [],
  familia: [],
};

export const GALLERY_LABEL: Record<GalleryKey, string> = {
  obra: "Fotos da obra",
  familia: "Fotos da família",
};

// Planta do apê: polígonos clicáveis (coordenadas do SVG do design).
export type PlanZone = {
  room: string;
  pts: string;
  tx: number;
  ty: number;
  note: string;
  dim: string;
  dx: number;
  dy: number;
  small?: boolean;
  nonote?: boolean;
};

export const PLAN: PlanZone[] = [
  { room: "Sala", pts: "245,140 420,140 420,300 700,300 700,440 565,440 565,660 245,660", tx: 262, ty: 410, note: "aqui vai o sofá (um dia)", dim: "2,91 × 4,00", dx: 262, dy: 645 },
  { room: "Cozinha", pts: "28,140 245,140 245,480 28,480", tx: 118, ty: 180, note: "a 1ª pizza sai daqui", dim: "2,60", dx: 118, dy: 470 },
  { room: "Lavanderia", pts: "28,480 235,480 235,660 28,660", tx: 40, ty: 520, note: "todo mundo precisa", dim: "1,60 × 1,40", dx: 112, dy: 650 },
  { room: "Banheiro", pts: "420,140 690,140 690,300 420,300", tx: 440, ty: 200, note: "", nonote: true, dim: "2,04 × 1,19", dx: 440, dy: 285 },
  { room: "Quarto", pts: "705,30 1015,30 1015,428 705,428", tx: 728, ty: 300, note: "o Lasanha vai querer subir", dim: "2,40 × 3,05", dx: 900, dy: 416 },
  { room: "Escritório", pts: "580,440 885,440 885,712 580,712", tx: 600, ty: 540, note: "home office pra dois", dim: "2,40 × 2,10", dx: 600, dy: 700 },
  { room: "Varanda", pts: "235,660 565,660 565,748 235,748", tx: 250, ty: 718, note: "", dim: "2,18 × 0,51", dx: 420, dy: 742, small: true },
];

// Ordem dos cômodos/categorias (os que não estão na planta viram chips).
export const ROOMS = ["Cozinha", "Sala", "Quarto", "Escritório", "Banheiro", "Lavanderia", "Varanda", "Lasanha", "Decoração", "Utilidades", "Outros"];

export type PriceBand = { id: string; label: string; minCents: number; maxCents: number };

export const BANDS: PriceBand[] = [
  { id: "todos", label: "todos os valores", minCents: 0, maxCents: Infinity },
  { id: "ate50", label: "até R$ 50", minCents: 0, maxCents: 5000 },
  { id: "ate150", label: "R$ 51 a 150", minCents: 5001, maxCents: 15000 },
  { id: "ate400", label: "R$ 151 a 400", minCents: 15001, maxCents: 40000 },
  { id: "mais", label: "acima de R$ 400", minCents: 40001, maxCents: Infinity },
];
