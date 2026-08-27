// The menu. Placeholder pricing and copy until the client sends the real card —
// the shape is what matters, and swapping the contents touches nothing else.
//
// photo:   basename in assets/photos (the four the client supplied)
// options: groups the order sheet renders; `add` is added to the base price
// tags:    V vegan · VG vegetarian · GF gluten free

const MILK = {
  id: "milk", label: "Milk", type: "one", default: "Whole",
  choices: [
    { id: "Whole", add: 0 }, { id: "Oat", add: 8000 },
    { id: "Almond", add: 10000 }, { id: "Lactose-free", add: 8000 },
  ],
};
const SHOT = {
  id: "shot", label: "Strength", type: "one", default: "Standard",
  choices: [{ id: "Standard", add: 0 }, { id: "Extra shot", add: 12000 }, { id: "Decaf", add: 0 }],
};
const CUP = {
  id: "cup", label: "Serve", type: "one", default: "Hot",
  choices: [{ id: "Hot", add: 0 }, { id: "Iced", add: 6000 }],
};
const SIZE = {
  id: "size", label: "Size", type: "one", default: "Regular",
  choices: [{ id: "Regular", add: 0 }, { id: "Large", add: 20000 }],
};

export const CATEGORIES = [
  { id: "espresso",  name: "Espresso",   note: "Our house blend, pulled to order" },
  { id: "filter",    name: "Filter & Cold", note: "Single origin, brewed by the cup" },
  { id: "notcoffee", name: "Not Coffee", note: "For the afternoon" },
  { id: "smoothie",  name: "Smoothies",  note: "Fruit, ice, nothing else" },
  { id: "breakfast", name: "Breakfast",  note: "Served until 13:00" },
  { id: "sweets",    name: "Sweets",     note: "Baked in-house each morning" },
];

export const ITEMS = [
  /* --------------------------------------------------------- espresso */
  { id: "espresso", cat: "espresso", name: "Espresso", price: 65000,
    desc: "Two ristretto shots, dense and short.", options: [SHOT] },
  { id: "americano", cat: "espresso", name: "Americano", price: 78000,
    desc: "Espresso lengthened with hot water.", options: [SHOT, CUP] },
  { id: "cortado", cat: "espresso", name: "Cortado", price: 88000,
    desc: "Equal parts espresso and warm milk.", options: [MILK, SHOT] },
  { id: "cappuccino", cat: "espresso", name: "Cappuccino", price: 95000,
    desc: "Six ounces, dry foam, cocoa if you want it.", options: [MILK, SHOT] },
  { id: "flat-white", cat: "espresso", name: "Flat White", price: 105000,
    desc: "Double ristretto under thin microfoam.", options: [MILK, SHOT] },
  { id: "latte", cat: "espresso", name: "Latte", price: 105000,
    desc: "The long, quiet one.", options: [MILK, SHOT, CUP] },
  { id: "spanish-latte", cat: "espresso", name: "Spanish Latte", price: 125000,
    desc: "Condensed milk, espresso, a pinch of salt.", options: [MILK, CUP] },
  { id: "mocha", cat: "espresso", name: "Mocha", price: 128000,
    desc: "70% dark chocolate, steamed through.", options: [MILK, SHOT, CUP] },

  /* ----------------------------------------------------------- filter */
  { id: "v60", cat: "filter", name: "V60", price: 130000,
    desc: "Rotating single origin. Ask what is on today.", tags: ["V"] },
  { id: "chemex", cat: "filter", name: "Chemex", price: 145000,
    desc: "Brewed for two, poured at the table.", tags: ["V"] },
  { id: "cold-brew", cat: "filter", name: "Cold Brew", price: 120000,
    desc: "Eighteen hours, no heat, over ice.", tags: ["V"] },
  { id: "iced-latte", cat: "filter", name: "Iced Latte", price: 115000,
    desc: "Cold milk, fresh shots, tall glass.", options: [MILK, SHOT] },
  { id: "affogato", cat: "filter", name: "Affogato", price: 135000,
    desc: "Vanilla gelato drowned in espresso.", tags: ["VG"] },

  /* ------------------------------------------------------- not coffee */
  { id: "matcha", cat: "notcoffee", name: "Matcha Latte", price: 145000,
    desc: "Ceremonial grade, whisked to order.", options: [MILK, CUP], tags: ["VG"] },
  { id: "chai", cat: "notcoffee", name: "Chai Latte", price: 115000,
    desc: "Cardamom, clove, black pepper, steeped slow.", options: [MILK, CUP], tags: ["VG"] },
  { id: "hot-chocolate", cat: "notcoffee", name: "Hot Chocolate", price: 120000,
    desc: "Melted dark chocolate, not powder.", options: [MILK], tags: ["VG"] },
  { id: "pot-of-tea", cat: "notcoffee", name: "Pot of Tea", price: 85000,
    desc: "Black, green, or herbal. Serves two.", tags: ["V"] },

  /* -------------------------------------------------------- smoothies */
  { id: "sky-smoothie", cat: "smoothie", name: "Sky Smoothie", price: 185000,
    desc: "Blue spirulina, coconut milk, banana, lime.",
    photo: "sky-smoothie", options: [SIZE], tags: ["V", "GF"], featured: true },
  { id: "melon-strawberry", cat: "smoothie", name: "Melon Strawberry Smoothie", price: 175000,
    desc: "Watermelon and strawberry, blended with nothing added.",
    photo: "melon-strawberry", options: [SIZE], tags: ["V", "GF"], featured: true },
  { id: "mango-berry", cat: "smoothie", name: "Mango Berry Smoothie", price: 178000,
    desc: "Mango, pineapple, strawberry, a spoon of freeze-dried berry.",
    photo: "mango-berry", options: [SIZE], tags: ["V", "GF"], featured: true },
  { id: "green-balance", cat: "smoothie", name: "Green Balance", price: 168000,
    desc: "Spinach, green apple, cucumber, mint, ginger.",
    options: [SIZE], tags: ["V", "GF"] },

  /* -------------------------------------------------------- breakfast */
  { id: "tomato-omelet", cat: "breakfast", name: "Tomato Omelet", price: 210000,
    desc: "Tomato, egg, red radish, cherry tomato, arugula, Italian basil, green onion.",
    photo: "tomato-omelet", tags: ["VG", "GF"], featured: true,
    options: [{ id: "bread", label: "With", type: "one", default: "Sourdough",
      choices: [{ id: "Sourdough", add: 0 }, { id: "Barbari", add: 0 }, { id: "No bread", add: -15000 }] }] },
  { id: "balance-plate", cat: "breakfast", name: "Balance Breakfast Plate", price: 385000,
    desc: "Two eggs your way, labneh, olives, honeycomb, walnut, seasonal fruit, bread.",
    tags: ["VG"] },
  { id: "avocado-toast", cat: "breakfast", name: "Avocado Toast", price: 235000,
    desc: "Smashed avocado on sourdough, chilli, lemon, sesame.", tags: ["V"],
    options: [{ id: "egg", label: "Add", type: "one", default: "As is",
      choices: [{ id: "As is", add: 0 }, { id: "Poached egg", add: 45000 }, { id: "Feta", add: 38000 }] }] },
  { id: "granola-bowl", cat: "breakfast", name: "Granola Bowl", price: 195000,
    desc: "House granola, yoghurt, date syrup, fruit of the day.", tags: ["VG"] },
  { id: "labneh-plate", cat: "breakfast", name: "Labneh & Herbs", price: 205000,
    desc: "Strained yoghurt, olive oil, za'atar, garden herbs, warm bread.", tags: ["VG"] },
  { id: "croissant-eggs", cat: "breakfast", name: "Croissant & Eggs", price: 245000,
    desc: "Butter croissant, scrambled eggs, chives.", tags: ["VG"] },

  /* ----------------------------------------------------------- sweets */
  { id: "basque", cat: "sweets", name: "Basque Cheesecake", price: 195000,
    desc: "Burnt top, barely set centre.", tags: ["VG"] },
  { id: "carrot-cake", cat: "sweets", name: "Carrot Cake", price: 175000,
    desc: "Walnut, cinnamon, cream cheese.", tags: ["VG"] },
  { id: "date-brownie", cat: "sweets", name: "Date Brownie", price: 165000,
    desc: "Sweetened with dates alone.", tags: ["V", "GF"] },
  { id: "cinnamon-roll", cat: "sweets", name: "Cinnamon Roll", price: 168000,
    desc: "Out of the oven at nine and at four.", tags: ["VG"] },
];

export const byId = (id) => ITEMS.find((i) => i.id === id) || null;
export const inCategory = (cat) => ITEMS.filter((i) => i.cat === cat);
export const featured = () => ITEMS.filter((i) => i.featured);

export const TAG_LABEL = { V: "Vegan", VG: "Vegetarian", GF: "Gluten free" };

/** Base price plus every selected option's surcharge. */
export function priceWith(item, opts) {
  let total = item.price;
  for (const group of item.options || []) {
    const chosen = opts?.[group.id];
    const choice = group.choices.find((c) => c.id === chosen);
    if (choice) total += choice.add || 0;
  }
  return total;
}

export function defaultOpts(item, profile) {
  const out = {};
  for (const group of item.options || []) {
    out[group.id] = group.default;
    // Honour the drinker's usual milk without making them set it every time.
    if (group.id === "milk" && profile?.defaultMilk
        && group.choices.some((c) => c.id === profile.defaultMilk)) {
      out.milk = profile.defaultMilk;
    }
  }
  return out;
}

/** "Oat · Extra shot · Large" — only the parts that differ from the default. */
export function describeOpts(item, opts) {
  const parts = [];
  for (const group of item.options || []) {
    const v = opts?.[group.id];
    if (v && v !== group.default) parts.push(v);
  }
  return parts.join(" · ");
}
