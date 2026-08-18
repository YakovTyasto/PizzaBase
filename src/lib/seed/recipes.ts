import type { SeedRecipe } from './types'
import { amt, qual, rng, unk } from './types'

/**
 * The owner's starting collection.
 *
 * Two rules govern everything in this file:
 *
 * 1. Quantities the owner never stated are `unknown`, and the recipe carries
 *    `needs_review` plus a field evidence row explaining what is missing. No
 *    plausible-looking number is ever filled in on their behalf.
 * 2. Where a source states a figure, it is recorded verbatim together with its
 *    attribution, and any arithmetic that does not add up is surfaced as a
 *    conflict rather than quietly corrected.
 *
 * That is why the seven pizzas below are `draft` with unknown amounts while the
 * dough recipes carry full formulas: the difference reflects what is actually
 * known, not what would make a nicer demo.
 */

const USER_SOURCE = {
  sourceType: 'user' as const,
  author: null,
  title: null,
  url: null,
  credibilityTier: 0.7,
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

const tomatoSauce: SeedRecipe = {
  slug: 'tomato-sauce-user',
  type: 'sauce',
  status: 'needs_review',
  authenticity: 'user_verified',
  originLocale: 'ru',
  // Yield follows the net weight of the can, which the owner has not fixed yet.
  // Leaving it null makes the app say so instead of assuming a 400 g tin.
  baseYield: null,
  yieldUnit: 'g',
  activeMinutes: 10,
  passiveMinutes: 0,
  difficulty: 1,
  tags: ['raw', 'no-cook'],
  names: {
    ru: 'Томатный соус для пиццы',
    en: 'Pizza Tomato Sauce',
    fr: 'Sauce tomate pour pizza',
  },
  summaries: {
    ru: 'Сырой неварёный соус: только томаты, базилик, соль и оливковое масло.',
    en: 'A raw, uncooked sauce: tomatoes, basil, salt and olive oil, nothing else.',
    fr: 'Une sauce crue, non cuite : tomates, basilic, sel et huile d’olive.',
  },
  notes: {
    ru: 'Выход зависит от веса банки — задайте упаковку, чтобы рассчитать его.',
    en: 'The yield depends on the can size — set the package to calculate it.',
    fr: 'Le rendement dépend de la boîte — choisissez l’emballage pour le calculer.',
  },
  items: [
    {
      key: 'tomatoes',
      ingredientSlug: 'tomatoes-whole-peeled-canned',
      amount: amt(1, 'can'),
      notes: {
        ru: 'Вес нетто банки не задан.',
        en: 'Net weight of the can is not set.',
        fr: 'Le poids net de la boîte n’est pas défini.',
      },
    },
    { key: 'basil', ingredientSlug: 'basil-fresh', amount: qual('to_taste') },
    // The owner did not state an amount of oil, so it stays unknown.
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk() },
    { key: 'salt', ingredientSlug: 'salt-sea', amount: qual('to_taste') },
  ],
  steps: [
    {
      key: 'crush',
      phase: 'prep',
      activeMinutes: 5,
      durationKnown: true,
      itemKeys: ['tomatoes'],
      instructions: {
        ru: 'Раздавить помидоры руками, сохраняя живую неоднородную текстуру.',
        en: 'Crush the tomatoes by hand, keeping a lively, uneven texture.',
        fr: 'Écraser les tomates à la main en gardant une texture vivante et irrégulière.',
      },
      cues: {
        ru: 'Не измельчайте блендером — соус должен остаться неровным.',
        en: 'Do not blend — the sauce should stay rustic and uneven.',
        fr: 'Ne pas mixer — la sauce doit rester rustique.',
      },
    },
    {
      key: 'basil-step',
      phase: 'prep',
      activeMinutes: 2,
      durationKnown: true,
      itemKeys: ['basil'],
      instructions: {
        ru: 'Порвать листья базилика руками и добавить к помидорам.',
        en: 'Tear the basil leaves by hand and add them to the tomatoes.',
        fr: 'Déchirer les feuilles de basilic à la main et les ajouter aux tomates.',
      },
    },
    {
      key: 'salt-step',
      phase: 'prep',
      activeMinutes: 1,
      durationKnown: true,
      itemKeys: ['salt'],
      instructions: {
        ru: 'Посолить по вкусу.',
        en: 'Salt to taste.',
        fr: 'Saler selon le goût.',
      },
    },
    {
      key: 'oil-step',
      phase: 'prep',
      activeMinutes: 2,
      durationKnown: true,
      itemKeys: ['oil'],
      instructions: {
        ru: 'Добавить оливковое масло и перемешать.',
        en: 'Add the olive oil and stir.',
        fr: 'Ajouter l’huile d’olive et mélanger.',
      },
    },
  ],
  source: USER_SOURCE,
  evidence: [
    {
      field: 'recipe.baseYield',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        ru: 'Выход не задан: зависит от веса нетто выбранной банки.',
        en: 'Yield is unset: it depends on the net weight of the chosen can.',
        fr: 'Rendement non défini : il dépend du poids net de la boîte choisie.',
      },
    },
    {
      field: 'item.amount',
      itemKey: 'oil',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        ru: 'Количество масла не указано владельцем.',
        en: 'The owner did not state how much oil to use.',
        fr: 'La quantité d’huile n’a pas été précisée.',
      },
    },
  ],
}

const pestoGenovese: SeedRecipe = {
  slug: 'pesto-genovese-user',
  type: 'prep',
  status: 'needs_review',
  authenticity: 'user_verified',
  originLocale: 'ru',
  // Stated as 150-170 g, which does not reconcile with the ingredient masses.
  // Recorded as given and flagged, never silently corrected.
  baseYield: '160',
  yieldUnit: 'g',
  activeMinutes: 20,
  difficulty: 2,
  names: { ru: 'Песто дженовезе', en: 'Pesto Genovese', fr: 'Pesto genovese' },
  summaries: {
    ru: 'Классическое песто владельца. Заявленный выход конфликтует с массой ингредиентов.',
    en: "The owner's pesto. The stated yield conflicts with the ingredient masses.",
    fr: 'Le pesto du propriétaire. Le rendement annoncé contredit la masse des ingrédients.',
  },
  items: [
    { key: 'basil', ingredientSlug: 'basil-fresh', amount: amt(50, 'g') },
    { key: 'pine-nuts', ingredientSlug: 'pine-nuts', amount: amt(30, 'g') },
    { key: 'garlic', ingredientSlug: 'garlic', amount: rng(1, 2, 'clove') },
    { key: 'parmesan', ingredientSlug: 'parmigiano-reggiano', amount: amt(70, 'g') },
    { key: 'pecorino', ingredientSlug: 'pecorino-sardo', amount: amt(30, 'g') },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: amt(75, 'ml') },
    { key: 'salt', ingredientSlug: 'salt-sea', amount: qual('pinch') },
  ],
  steps: [],
  source: USER_SOURCE,
  evidence: [
    {
      field: 'recipe.baseYield',
      confidence: 0.2,
      reviewState: 'conflict',
      conflictGroup: 'pesto-yield',
      notes: {
        ru: 'Заявленный выход 150–170 г, но сумма ингредиентов превышает 250 г ещё до потерь. Заявленная порция на пиццу — 30 г и 5–6 пицц. Требуется подтверждение владельца.',
        en: 'Stated yield is 150-170 g, yet the ingredients total over 250 g before any process loss. The stated pizza portion is 30 g across 5-6 pizzas. Needs the owner to confirm.',
        fr: 'Rendement annoncé de 150 à 170 g, alors que les ingrédients dépassent 250 g avant pertes. La portion annoncée est de 30 g pour 5 à 6 pizzas. À confirmer.',
      },
    },
    {
      field: 'recipe.steps',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        ru: 'Способ приготовления не записан.',
        en: 'The method was never written down.',
        fr: 'La méthode n’a pas été notée.',
      },
    },
  ],
}

const arrabbiataSauce: SeedRecipe = {
  slug: 'arrabbiata-sauce-user',
  type: 'sauce',
  status: 'needs_review',
  authenticity: 'user_verified',
  originLocale: 'ru',
  baseYield: null,
  yieldUnit: 'g',
  difficulty: 2,
  names: { ru: 'Соус аррабьята', en: 'Arrabbiata sauce', fr: 'Sauce arrabbiata' },
  summaries: {
    ru: 'Острый томатный соус. Пропорции ещё не записаны.',
    en: 'A spicy tomato sauce. The proportions have not been written down yet.',
    fr: 'Une sauce tomate piquante. Les proportions ne sont pas encore notées.',
  },
  items: [
    { key: 'tomatoes', ingredientSlug: 'tomatoes-whole-peeled-canned', amount: unk() },
    { key: 'garlic', ingredientSlug: 'garlic', amount: unk() },
    { key: 'chili', ingredientSlug: 'chili-flakes', amount: unk() },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk() },
    { key: 'salt', ingredientSlug: 'salt-sea', amount: qual('to_taste') },
  ],
  steps: [],
  source: USER_SOURCE,
  evidence: [
    {
      field: 'recipe.items',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        ru: 'Ни одно количество не задано.',
        en: 'No quantities have been recorded.',
        fr: 'Aucune quantité n’a été enregistrée.',
      },
    },
  ],
}

// ---------------------------------------------------------------------------
// The owner's pizzas
//
// Per the brief these are a personal starting collection, not documented
// classics: they are `draft` / `user_verified` rather than `traditional`, and
// every amount the owner did not state stays unknown.
// ---------------------------------------------------------------------------

function ownerPizza(
  slug: string,
  names: SeedRecipe['names'],
  summaries: SeedRecipe['summaries'],
  items: SeedRecipe['items'],
  extra: Partial<SeedRecipe> = {},
): SeedRecipe {
  return {
    slug,
    type: 'pizza',
    status: 'draft',
    authenticity: 'user_verified',
    originLocale: 'ru',
    styleSlug: 'napoletana',
    ovenProfileSlug: 'home-oven',
    baseYield: '1',
    yieldUnit: 'piece',
    baseShape: 'round',
    baseDiameterMm: 300,
    baseBallWeightG: '250',
    difficulty: 2,
    names,
    summaries,
    items,
    steps: [],
    source: USER_SOURCE,
    evidence: [
      {
        field: 'recipe.items',
        confidence: 0,
        reviewState: 'needs_review',
        notes: {
          ru: 'Количества не заданы владельцем — заполните их, чтобы включить пересчёт и список покупок.',
          en: 'The owner did not state amounts — fill them in to enable scaling and the shopping list.',
          fr: 'Les quantités ne sont pas renseignées — complétez-les pour activer le calcul et la liste de courses.',
        },
      },
    ],
    ...extra,
  }
}

const margherita = ownerPizza(
  'margherita-user',
  { ru: 'Маргарита', en: 'Margherita', fr: 'Margherita' },
  {
    ru: 'Томатный соус, моцарелла, пармезан, базилик и оливковое масло.',
    en: 'Tomato sauce, mozzarella, parmesan, basil and olive oil.',
    fr: 'Sauce tomate, mozzarella, parmesan, basilic et huile d’olive.',
  },
  [
    { key: 'sauce', componentSlug: 'tomato-sauce-user', amount: unk() },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk() },
    { key: 'basil', ingredientSlug: 'basil-fresh', amount: unk() },
    { key: 'mozzarella', ingredientSlug: 'mozzarella-fior-di-latte', amount: unk() },
    { key: 'parmesan', ingredientSlug: 'parmigiano-reggiano', amount: unk() },
  ],
)

const pepperoni = ownerPizza(
  'pepperoni-user',
  { ru: 'Пепперони', en: 'Pepperoni', fr: 'Pepperoni' },
  {
    ru: 'Томатный соус, моцарелла, пепперони, базилик и оливковое масло.',
    en: 'Tomato sauce, mozzarella, pepperoni, basil and olive oil.',
    fr: 'Sauce tomate, mozzarella, pepperoni, basilic et huile d’olive.',
  },
  [
    { key: 'sauce', componentSlug: 'tomato-sauce-user', amount: unk() },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk() },
    { key: 'basil', ingredientSlug: 'basil-fresh', amount: unk() },
    { key: 'mozzarella', ingredientSlug: 'mozzarella-fior-di-latte', amount: unk() },
    { key: 'pepperoni', ingredientSlug: 'pepperoni', amount: unk() },
  ],
)

const fourCheese = ownerPizza(
  'four-cheese-user',
  { ru: 'Четыре сыра', en: 'Four Cheese', fr: 'Quatre fromages' },
  {
    ru: 'Моцарелла, фонталь, пекорино и горгонзола. Без томатного соуса.',
    en: 'Mozzarella, fontal, pecorino and gorgonzola. No tomato sauce.',
    fr: 'Mozzarella, fontal, pecorino et gorgonzola. Sans sauce tomate.',
  },
  [
    { key: 'mozzarella', ingredientSlug: 'mozzarella-fior-di-latte', amount: unk() },
    { key: 'fontal', ingredientSlug: 'fontal', amount: unk() },
    { key: 'pecorino', ingredientSlug: 'pecorino', amount: unk() },
    { key: 'gorgonzola', ingredientSlug: 'gorgonzola', amount: unk() },
  ],
  { tags: ['bianca'] },
)

const pestoBufala = ownerPizza(
  'pesto-bufala-user',
  {
    ru: 'Песто и буфала',
    en: 'Pesto & Buffalo Mozzarella',
    fr: 'Pesto et mozzarella di bufala',
  },
  {
    ru: 'Песто дженовезе и моцарелла ди буфала.',
    en: 'Pesto genovese and mozzarella di bufala.',
    fr: 'Pesto genovese et mozzarella di bufala.',
  },
  [
    { key: 'pesto', componentSlug: 'pesto-genovese-user', amount: unk() },
    { key: 'bufala', ingredientSlug: 'mozzarella-di-bufala', amount: unk() },
  ],
  { tags: ['bianca'] },
)

const mortadellaArugula = ownerPizza(
  'mortadella-arugula-user',
  {
    ru: 'Мортаделла и руккола',
    en: 'Mortadella & Arugula',
    fr: 'Mortadelle et roquette',
  },
  {
    ru: 'Томатный соус, моцарелла, пармезан, мортаделла и руккола.',
    en: 'Tomato sauce, mozzarella, parmesan, mortadella and arugula.',
    fr: 'Sauce tomate, mozzarella, parmesan, mortadelle et roquette.',
  },
  [
    { key: 'sauce', componentSlug: 'tomato-sauce-user', amount: unk() },
    { key: 'mozzarella', ingredientSlug: 'mozzarella-fior-di-latte', amount: unk() },
    { key: 'parmesan', ingredientSlug: 'parmigiano-reggiano', amount: unk() },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk() },
    { key: 'mortadella', ingredientSlug: 'mortadella', amount: unk() },
    { key: 'arugula', ingredientSlug: 'arugula', amount: unk() },
  ],
)

const arrabbiata = ownerPizza(
  'arrabbiata-user',
  { ru: 'Арраббьята', en: 'Arrabbiata', fr: 'Arrabbiata' },
  {
    ru: 'Острый соус аррабьята, пармезан и колбаска. Вид колбаски не определён.',
    en: 'Spicy arrabbiata sauce, parmesan and sausage. The kind of sausage is undetermined.',
    fr: 'Sauce arrabbiata piquante, parmesan et saucisse. Le type de saucisse est indéterminé.',
  },
  [
    { key: 'sauce', componentSlug: 'arrabbiata-sauce-user', amount: unk() },
    { key: 'parmesan', ingredientSlug: 'parmigiano-reggiano', amount: unk() },
    { key: 'sausage', ingredientSlug: 'italian-sausage', amount: unk() },
  ],
  {
    status: 'needs_review',
    evidence: [
      {
        field: 'item.ingredient',
        itemKey: 'sausage',
        confidence: 0,
        reviewState: 'needs_review',
        notes: {
          ru: 'Вид колбаски не указан. Не подставлять произвольную колбасу — уточните у владельца.',
          en: 'The kind of sausage was never specified. Do not substitute an arbitrary sausage; ask the owner.',
          fr: 'Le type de saucisse n’a pas été précisé. Ne pas substituer une saucisse quelconque.',
        },
      },
    ],
  },
)

const pearGorgonzola = ownerPizza(
  'pear-gorgonzola-user',
  {
    ru: 'Груша и горгонзола',
    en: 'Pear & Gorgonzola',
    fr: 'Poire et gorgonzola',
  },
  {
    ru: 'Груша и горгонзола. Остальные ингредиенты не записаны.',
    en: 'Pear and gorgonzola. The remaining ingredients were not written down.',
    fr: 'Poire et gorgonzola. Les autres ingrédients ne sont pas notés.',
  },
  [
    { key: 'pear', ingredientSlug: 'pear', amount: unk() },
    { key: 'gorgonzola', ingredientSlug: 'gorgonzola', amount: unk() },
  ],
  { status: 'needs_review', tags: ['bianca'] },
)

// ---------------------------------------------------------------------------
// Dough recipes imported from YouTube sources
//
// Amounts here come from the source material. Anything the source did not state
// is `unknown`, and every disputed figure is recorded as a conflict.
// ---------------------------------------------------------------------------

const sisofoNeapolitan: SeedRecipe = {
  slug: 'sisofo-forgotten-neapolitan',
  type: 'dough',
  status: 'needs_review',
  authenticity: 'pizzaiolo',
  originLocale: 'en',
  styleSlug: 'napoletana',
  ovenProfileSlug: 'home-oven-steel',
  baseYield: '3',
  yieldUnit: 'piece',
  // 520 + 310 + 13 + 0.156 = 843.156 g over 3 balls.
  baseBallWeightG: '281',
  activeMinutes: 40,
  passiveMinutes: 1440,
  difficulty: 3,
  tags: ['direct', 'room-temperature'],
  names: {
    ru: 'Забытый стиль неаполитанской пиццы',
    en: 'The Forgotten Style of Neapolitan Pizza',
    fr: 'Le style oublié de la pizza napolitaine',
  },
  summaries: {
    en: 'A direct dough fermented about 24 hours at room temperature, for 3 pizzas.',
    ru: 'Прямое тесто, около 24 часов при комнатной температуре, на 3 пиццы.',
    fr: 'Une pâte directe, environ 24 h à température ambiante, pour 3 pizzas.',
  },
  items: [
    { key: 'flour', ingredientSlug: 'flour-type-00', amount: amt(520, 'g') },
    { key: 'water', ingredientSlug: 'water', amount: amt(310, 'g') },
    { key: 'salt', ingredientSlug: 'salt-sea', amount: amt(13, 'g') },
    // Stated as 0.03% of flour, i.e. about 0.16 g.
    { key: 'yeast', ingredientSlug: 'yeast-active-dry', amount: amt('0.156', 'g') },
  ],
  steps: [
    {
      key: 'mix',
      phase: 'mix',
      activeMinutes: 20,
      durationKnown: true,
      itemKeys: ['flour', 'water', 'salt', 'yeast'],
      instructions: {
        en: 'Mix flour, water, salt and yeast to a smooth dough.',
        ru: 'Смешать муку, воду, соль и дрожжи до гладкого теста.',
        fr: 'Mélanger farine, eau, sel et levure jusqu’à obtenir une pâte lisse.',
      },
    },
    {
      key: 'bulk',
      phase: 'bulk',
      waitMinMinutes: 1200,
      waitMaxMinutes: 1560,
      durationKnown: true,
      instructions: {
        en: 'Ferment at room temperature for about 24 hours.',
        ru: 'Ферментировать при комнатной температуре около 24 часов.',
        fr: 'Laisser fermenter à température ambiante environ 24 heures.',
      },
      cues: {
        en: 'The dough should be visibly risen and airy, not merely older.',
        ru: 'Тесто должно заметно подняться и стать воздушным.',
        fr: 'La pâte doit être visiblement levée et aérée.',
      },
    },
    {
      key: 'ball',
      phase: 'ball',
      activeMinutes: 15,
      durationKnown: true,
      instructions: {
        en: 'Divide and shape into 3 balls.',
        ru: 'Разделить и сформовать 3 шара.',
        fr: 'Diviser et former 3 pâtons.',
      },
    },
  ],
  source: {
    sourceType: 'youtube',
    author: 'Julian Sisofo',
    title: 'The Forgotten Style of Neapolitan Pizza',
    url: 'https://www.youtube.com/watch?v=o35mHoq5v0s',
    credibilityTier: 0.9,
    attribution: 'Formula as stated by Julian Sisofo.',
  },
  evidence: [
    {
      field: 'recipe.method',
      confidence: 0.5,
      reviewState: 'needs_review',
      notes: {
        en: 'Mixing method and exact timings still need to be verified against the video before this can be marked verified.',
        ru: 'Метод замеса и точные тайминги требуют проверки по видео.',
        fr: 'La méthode de pétrissage et les durées exactes restent à vérifier.',
      },
    },
    {
      field: 'item.amount',
      itemKey: 'yeast',
      confidence: 0.8,
      reviewState: 'needs_review',
      notes: {
        en: 'Stated as 0.03% of flour, which works out to about 0.16 g.',
        ru: 'Указано 0,03% от муки, то есть примерно 0,16 г.',
        fr: 'Indiqué à 0,03 % de la farine, soit environ 0,16 g.',
      },
    },
  ],
}

const sisofoTeglia: SeedRecipe = {
  slug: 'sisofo-crispiest-teglia',
  type: 'dough',
  status: 'needs_review',
  authenticity: 'pizzaiolo',
  originLocale: 'en',
  styleSlug: 'romana-teglia',
  ovenProfileSlug: 'home-oven',
  baseYield: '2',
  yieldUnit: 'piece',
  baseBallWeightG: '690',
  baseShape: 'rectangular',
  // 16 x 12 inch tray.
  baseTrayWidthMm: 406,
  baseTrayHeightMm: 305,
  difficulty: 4,
  tags: ['biga', 'pan'],
  names: {
    ru: 'Самая хрустящая пицца, которую вы не готовили',
    en: "The Crispiest Pizza You've Never Made",
    fr: 'La pizza la plus croustillante que vous n’avez jamais faite',
  },
  summaries: {
    en: 'Roman pizza in teglia built on a biga: two 16x12 inch trays, about 690 g of dough each.',
    ru: 'Римская пицца в противне на биге: два противня 16×12 дюймов, примерно по 690 г теста.',
    fr: 'Pizza romaine en plaque sur biga : deux plaques de 16×12 pouces, environ 690 g chacune.',
  },
  items: [
    { key: 'biga-flour', ingredientSlug: 'flour-pinsa', amount: amt(400, 'g'), group: 'biga' },
    { key: 'biga-water', ingredientSlug: 'water', amount: amt(200, 'g'), group: 'biga' },
    { key: 'biga-yeast', ingredientSlug: 'yeast-active-dry', amount: amt(2, 'g'), group: 'biga' },
    // The video's final-dough additions were not captured; left unknown.
    { key: 'final-water', ingredientSlug: 'water', amount: unk(), group: 'final' },
    { key: 'final-salt', ingredientSlug: 'salt-sea', amount: unk(), group: 'final' },
    { key: 'final-oil', ingredientSlug: 'olive-oil-extra-virgin', amount: unk(), group: 'final' },
  ],
  steps: [
    {
      key: 'biga',
      phase: 'preferment',
      activeMinutes: 15,
      durationKnown: false,
      itemKeys: ['biga-flour', 'biga-water', 'biga-yeast'],
      instructions: {
        en: 'Start the biga with 2 g active dry yeast, 400 g pinsa flour and 200 g water.',
        ru: 'Завести бигу: 2 г сухих дрожжей, 400 г муки для пинсы и 200 г воды.',
        fr: 'Préparer la biga : 2 g de levure sèche, 400 g de farine à pinsa et 200 g d’eau.',
      },
      cues: {
        en: 'Fermentation time for the biga was not captured from the source.',
        ru: 'Время ферментации биги из источника не зафиксировано.',
        fr: 'Le temps de fermentation de la biga n’a pas été relevé.',
      },
    },
  ],
  source: {
    sourceType: 'youtube',
    author: 'Julian Sisofo',
    title: "The Crispiest Pizza You've Never Made",
    url: 'https://www.youtube.com/watch?v=Wc1i3-afCTc',
    credibilityTier: 0.9,
    attribution: 'Biga quantities as stated by Julian Sisofo.',
  },
  evidence: [
    {
      field: 'recipe.items',
      confidence: 0.3,
      reviewState: 'needs_review',
      notes: {
        en: 'Only the biga is documented. Final-dough quantities and all timings need transcript or source verification.',
        ru: 'Задокументирована только бига. Количества финального теста и тайминги требуют проверки.',
        fr: 'Seule la biga est documentée. Les quantités finales et les durées restent à vérifier.',
      },
    },
  ],
}

const sisofoTonda: SeedRecipe = {
  slug: 'sisofo-roman-thin-crust',
  type: 'dough',
  status: 'needs_review',
  authenticity: 'pizzaiolo',
  originLocale: 'en',
  styleSlug: 'romana-tonda',
  ovenProfileSlug: 'home-oven-steel',
  // The source did not state how many pizzas this makes.
  baseYield: null,
  yieldUnit: 'piece',
  baseShape: 'round',
  difficulty: 3,
  tags: ['direct', 'thin'],
  names: {
    ru: 'Идеальная римская тонкая пицца',
    en: 'How to Make Perfect Roman Thin Crust Pizza',
    fr: 'La pizza romaine fine parfaite',
  },
  summaries: {
    en: 'Pizza tonda romana: a low-hydration, rolled, crisp base.',
    ru: 'Пицца тонда романа: низкая гидратация, раскатанная хрустящая основа.',
    fr: 'Pizza tonda romana : faible hydratation, base croustillante étalée au rouleau.',
  },
  items: [
    { key: 'flour', ingredientSlug: 'flour-type-0', amount: amt(380, 'g') },
    { key: 'water', ingredientSlug: 'water', amount: amt(210, 'g') },
    { key: 'salt', ingredientSlug: 'salt-sea', amount: amt(8, 'g') },
    { key: 'yeast', ingredientSlug: 'yeast-active-dry', amount: amt('0.5', 'g') },
    { key: 'oil', ingredientSlug: 'olive-oil-extra-virgin', amount: amt(15, 'g') },
  ],
  steps: [],
  source: {
    sourceType: 'youtube',
    author: 'Julian Sisofo',
    title: 'How to Make Perfect Roman Thin Crust Pizza',
    url: 'https://www.youtube.com/watch?v=ubT1JUypPwE',
    credibilityTier: 0.9,
    attribution: 'Formula as stated by Julian Sisofo.',
  },
  evidence: [
    {
      field: 'recipe.baseYield',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        en: 'The number of pizzas this formula makes was not stated. Hydration works out to about 55.26%.',
        ru: 'Количество пицц не указано. Гидратация составляет около 55,26%.',
        fr: 'Le nombre de pizzas n’est pas indiqué. L’hydratation est d’environ 55,26 %.',
      },
    },
    {
      field: 'recipe.method',
      confidence: 0,
      reviewState: 'needs_review',
      notes: {
        en: 'The full method still needs to be transcribed from the source.',
        ru: 'Полный метод требует расшифровки из источника.',
        fr: 'La méthode complète reste à transcrire.',
      },
    },
  ],
}

const iacopelliPoolish: SeedRecipe = {
  slug: 'iacopelli-poolish-double-fermentation',
  type: 'dough',
  status: 'needs_review',
  authenticity: 'pizzaiolo',
  originLocale: 'en',
  styleSlug: 'contemporanea',
  ovenProfileSlug: 'home-oven-steel',
  baseYield: null,
  yieldUnit: 'piece',
  activeMinutes: 60,
  passiveMinutes: 1440,
  difficulty: 4,
  tags: ['poolish', 'double-fermentation'],
  names: {
    ru: 'Тесто нового уровня: двойная ферментация на пулише',
    en: 'Next Level Pizza Dough: Double Fermentation with Poolish',
    fr: 'Pâte à pizza de niveau supérieur : double fermentation au poolish',
  },
  summaries: {
    en: 'A poolish-based dough at roughly 70% total hydration. Several figures are disputed between sources.',
    ru: 'Тесто на пулише с общей гидратацией около 70%. Ряд значений расходится между источниками.',
    fr: 'Une pâte au poolish à environ 70 % d’hydratation. Plusieurs valeurs divergent selon les sources.',
  },
  items: [
    { key: 'poolish-water', ingredientSlug: 'water', amount: amt(300, 'g'), group: 'poolish' },
    {
      key: 'poolish-flour',
      ingredientSlug: 'flour-type-00',
      amount: amt(300, 'g'),
      group: 'poolish',
    },
    { key: 'poolish-honey', ingredientSlug: 'honey', amount: amt(5, 'g'), group: 'poolish' },
    // Third-party transcriptions disagree; recorded as the stated range.
    {
      key: 'poolish-yeast',
      ingredientSlug: 'yeast-active-dry',
      amount: rng(5, 6, 'g'),
      group: 'poolish',
    },
    { key: 'final-water', ingredientSlug: 'water', amount: amt(400, 'g'), group: 'final' },
    { key: 'final-flour', ingredientSlug: 'flour-type-00', amount: amt(700, 'g'), group: 'final' },
    { key: 'final-salt', ingredientSlug: 'salt-sea', amount: rng(25, 30, 'g'), group: 'final' },
    {
      key: 'final-oil',
      ingredientSlug: 'olive-oil-extra-virgin',
      amount: amt(10, 'g'),
      group: 'final',
    },
  ],
  steps: [
    {
      key: 'poolish',
      phase: 'preferment',
      activeMinutes: 10,
      waitMinMinutes: 60,
      waitMaxMinutes: 1080,
      durationKnown: false,
      itemKeys: ['poolish-water', 'poolish-flour', 'poolish-honey', 'poolish-yeast'],
      instructions: {
        en: 'Make the poolish from water, flour, honey and yeast, then let it ferment.',
        ru: 'Приготовить пулиш из воды, муки, мёда и дрожжей и дать ему выбродить.',
        fr: 'Préparer le poolish avec eau, farine, miel et levure, puis laisser fermenter.',
      },
      cues: {
        en: 'Ready when domed and bubbling; the exact time was not captured.',
        ru: 'Готов, когда куполом и в пузырях; точное время не зафиксировано.',
        fr: 'Prêt lorsqu’il est bombé et bullé ; la durée exacte n’a pas été relevée.',
      },
    },
  ],
  source: {
    sourceType: 'youtube',
    author: 'Vito Iacopelli',
    title: 'Next Level Pizza Dough / Double Fermentation with Poolish',
    url: 'https://www.youtube.com/watch?v=u7Hd6ZzKgBM',
    credibilityTier: 0.85,
    attribution: 'Candidate formula attributed to Vito Iacopelli; several fields disputed.',
  },
  evidence: [
    {
      field: 'item.amount',
      itemKey: 'poolish-yeast',
      confidence: 0.4,
      reviewState: 'conflict',
      conflictGroup: 'iacopelli-yeast',
      notes: {
        en: 'Third-party parses disagree on the yeast weight (5 g vs 6 g). Recorded as a range until the primary video or description confirms one value.',
        ru: 'Сторонние расшифровки расходятся по весу дрожжей (5 г против 6 г). Записано диапазоном до подтверждения.',
        fr: 'Les transcriptions tierces divergent sur la levure (5 g contre 6 g). Enregistré comme une plage.',
      },
    },
    {
      field: 'item.amount',
      itemKey: 'final-salt',
      confidence: 0.4,
      reviewState: 'conflict',
      conflictGroup: 'iacopelli-salt',
      notes: {
        en: 'Salt is reported as 25 g by some sources and 30 g by others, i.e. 2.5% vs 3% of flour. No value is chosen automatically.',
        ru: 'Соль указывается то как 25 г, то как 30 г — 2,5% против 3% от муки. Значение не выбирается автоматически.',
        fr: 'Le sel est indiqué à 25 g ou 30 g selon les sources, soit 2,5 % contre 3 %. Aucune valeur n’est choisie automatiquement.',
      },
    },
    {
      field: 'recipe.baseYield',
      confidence: 0.2,
      reviewState: 'conflict',
      conflictGroup: 'iacopelli-yield',
      notes: {
        en: 'The number and weight of dough balls is disputed. Total hydration works out to about 70%.',
        ru: 'Количество и вес шаров теста спорны. Общая гидратация — около 70%.',
        fr: 'Le nombre et le poids des pâtons sont contestés. L’hydratation totale est d’environ 70 %.',
      },
    },
  ],
}

export const recipes: SeedRecipe[] = [
  tomatoSauce,
  pestoGenovese,
  arrabbiataSauce,
  margherita,
  pepperoni,
  fourCheese,
  pestoBufala,
  mortadellaArugula,
  arrabbiata,
  pearGorgonzola,
  sisofoNeapolitan,
  sisofoTeglia,
  sisofoTonda,
  iacopelliPoolish,
]
