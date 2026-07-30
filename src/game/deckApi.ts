interface DeckApiCard {
  code: string;
  image: string;
}

interface DrawCardsResponse {
  cards: DeckApiCard[];
}

export type CardImageMap = Record<string, string>;

export const fetchCardImageMap = async (): Promise<CardImageMap> => {
  const response = await fetch("https://deckofcardsapi.com/api/deck/new/draw/?count=52");
  if (!response.ok) {
    throw new Error("Unable to download card deck art.");
  }

  const payload = (await response.json()) as DrawCardsResponse;
  const map: CardImageMap = {};
  payload.cards.forEach((card) => {
    map[card.code] = card.image;
  });
  map.BACK = "https://deckofcardsapi.com/static/img/back.png";
  return map;
};
