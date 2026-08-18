import type {
  SeedCategory,
  SeedIngredient,
  SeedOvenProfile,
  SeedPackageOption,
  SeedStyle,
  SeedSubstitution,
} from './types'
import { amt } from './types'

export const categories: SeedCategory[] = [
  {
    slug: 'produce',
    sortOrder: 10,
    names: { ru: 'Овощи и фрукты', en: 'Produce', fr: 'Fruits et légumes' },
  },
  { slug: 'herbs', sortOrder: 20, names: { ru: 'Зелень', en: 'Herbs', fr: 'Herbes' } },
  {
    slug: 'dairy',
    sortOrder: 30,
    names: { ru: 'Молочные продукты', en: 'Dairy', fr: 'Produits laitiers' },
  },
  {
    slug: 'deli',
    sortOrder: 40,
    names: { ru: 'Мясная гастрономия', en: 'Deli', fr: 'Charcuterie' },
  },
  {
    slug: 'canned',
    sortOrder: 50,
    names: { ru: 'Консервы', en: 'Canned goods', fr: 'Conserves' },
  },
  { slug: 'baking', sortOrder: 60, names: { ru: 'Для выпечки', en: 'Baking', fr: 'Boulangerie' } },
  { slug: 'pantry', sortOrder: 70, names: { ru: 'Бакалея', en: 'Pantry', fr: 'Épicerie' } },
]

/**
 * Canonical ingredients.
 *
 * Different kinds of mozzarella and pecorino stay separate records -- fior di
 * latte and bufala behave differently on a pizza -- but are linked through a
 * `parentSlug` so search and substitutions can still relate them.
 *
 * Densities are only filled in where a real figure exists. An ingredient with
 * no density simply cannot be converted between ml and g, which is the correct
 * outcome rather than a plausible-looking guess.
 */
export const ingredients: SeedIngredient[] = [
  // --- Canned / tomatoes -------------------------------------------------
  {
    slug: 'tomatoes-whole-peeled-canned',
    categorySlug: 'canned',
    measure: 'mass',
    baseUnit: 'g',
    names: {
      ru: 'Целые очищенные томаты в собственном соку',
      en: 'Whole peeled tomatoes in their own juice',
      fr: 'Tomates pelées entières dans leur jus',
    },
    aliases: {
      ru: ['томаты в собственном соку', 'помидоры очищенные', 'консервированные томаты'],
      en: ['canned tomatoes', 'peeled tomatoes', 'pelati', 'san marzano'],
      fr: ['tomates pelées', 'tomates en conserve', 'pelati'],
    },
  },

  // --- Oils / pantry -----------------------------------------------------
  {
    slug: 'olive-oil-extra-virgin',
    categorySlug: 'pantry',
    measure: 'volume',
    baseUnit: 'ml',
    // Extra virgin olive oil is ~0.91 g/ml at room temperature.
    densityGPerMl: '0.91',
    names: {
      ru: 'Оливковое масло extra virgin',
      en: 'Extra virgin olive oil',
      fr: "Huile d'olive extra vierge",
    },
    aliases: {
      ru: ['оливковое масло', 'масло оливковое первого отжима'],
      en: ['evoo', 'olive oil', 'extra-virgin olive oil'],
      fr: ["huile d'olive", 'huile olive vierge extra'],
    },
  },
  {
    slug: 'salt-sea',
    categorySlug: 'pantry',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Морская соль', en: 'Sea salt', fr: 'Sel de mer' },
    aliases: { ru: ['соль'], en: ['salt', 'fine sea salt'], fr: ['sel'] },
  },
  {
    slug: 'water',
    categorySlug: 'pantry',
    measure: 'mass',
    baseUnit: 'g',
    // Water is the one case where 1 ml = 1 g is a fact, not an assumption.
    densityGPerMl: '1',
    names: { ru: 'Вода', en: 'Water', fr: 'Eau' },
    aliases: { ru: ['вода питьевая'], en: ['cold water'], fr: ['eau froide'] },
  },
  {
    slug: 'honey',
    categorySlug: 'pantry',
    measure: 'mass',
    baseUnit: 'g',
    densityGPerMl: '1.42',
    names: { ru: 'Мёд', en: 'Honey', fr: 'Miel' },
    aliases: { ru: ['мед'], en: ['runny honey'], fr: ['miel liquide'] },
  },
  {
    slug: 'pine-nuts',
    categorySlug: 'pantry',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Кедровые орехи', en: 'Pine nuts', fr: 'Pignons de pin' },
    aliases: { ru: ['пиния', 'орехи кедровые'], en: ['pinoli', 'pignoli'], fr: ['pignons'] },
    allergens: ['tree_nuts'],
  },

  // --- Flour and leavening ----------------------------------------------
  {
    slug: 'flour-type-00',
    categorySlug: 'baking',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Мука типа 00', en: 'Type 00 flour', fr: 'Farine type 00' },
    aliases: {
      ru: ['мука 00', 'мука для пиццы'],
      en: ['00 flour', 'tipo 00', 'doppio zero'],
      fr: ['farine 00', 'farine tipo 00'],
    },
    allergens: ['gluten'],
  },
  {
    slug: 'flour-type-0',
    categorySlug: 'baking',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Мука типа 0', en: 'Type 0 flour', fr: 'Farine type 0' },
    aliases: { ru: ['мука 0'], en: ['0 flour', 'tipo 0'], fr: ['farine 0'] },
    allergens: ['gluten'],
  },
  {
    slug: 'flour-pinsa',
    categorySlug: 'baking',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Мука для пинсы', en: 'Pinsa flour', fr: 'Farine à pinsa' },
    aliases: {
      ru: ['мука пинса'],
      en: ['pinsa blend', 'molino signetti pinsa'],
      fr: ['farine pinsa'],
    },
    allergens: ['gluten'],
    notes: {
      en: 'A blended flour (typically wheat with rice and soy) sold specifically for pinsa.',
    },
  },
  {
    slug: 'yeast-active-dry',
    categorySlug: 'baking',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Сухие активные дрожжи', en: 'Active dry yeast', fr: 'Levure sèche active' },
    aliases: {
      ru: ['дрожжи сухие', 'дрожжи'],
      en: ['ady', 'dry yeast', 'yeast'],
      fr: ['levure sèche', 'levure'],
    },
  },

  // --- Cheese ------------------------------------------------------------
  {
    slug: 'mozzarella',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Моцарелла', en: 'Mozzarella', fr: 'Mozzarella' },
    aliases: { ru: ['моцарела'], en: ['mozzarella cheese'], fr: [] },
    notes: {
      en: 'Parent category. Prefer fior di latte or di bufala for a specific recipe.',
    },
  },
  {
    slug: 'mozzarella-fior-di-latte',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    parentSlug: 'mozzarella',
    names: {
      ru: 'Моцарелла фиор ди латте',
      en: 'Mozzarella fior di latte',
      fr: 'Mozzarella fior di latte',
    },
    aliases: {
      ru: ['фиор ди латте', 'моцарелла коровья'],
      en: ['fior di latte', 'cow milk mozzarella'],
      fr: ['fior di latte', 'mozzarella au lait de vache'],
    },
    allergens: ['milk'],
  },
  {
    slug: 'mozzarella-di-bufala',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    parentSlug: 'mozzarella',
    names: {
      ru: 'Моцарелла ди буфала',
      en: 'Mozzarella di bufala',
      fr: 'Mozzarella di bufala',
    },
    aliases: {
      ru: ['буффала', 'буйволиная моцарелла', 'моцарелла из буйволиного молока'],
      en: ['buffalo mozzarella', 'bufala', 'mozzarella di bufala campana'],
      fr: ['mozzarella de bufflonne', 'bufflonne'],
    },
    allergens: ['milk'],
  },
  {
    slug: 'parmigiano-reggiano',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Пармезан', en: 'Parmesan', fr: 'Parmesan' },
    aliases: {
      ru: ['пармиджано реджано', 'пармиджано'],
      en: ['parmigiano reggiano', 'parmigiano', 'parmesan cheese'],
      fr: ['parmigiano reggiano', 'parmigiano'],
    },
    allergens: ['milk'],
  },
  {
    slug: 'pecorino',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Пекорино', en: 'Pecorino', fr: 'Pecorino' },
    aliases: { ru: ['пекорино романо'], en: ['pecorino romano'], fr: ['pécorino'] },
    allergens: ['milk'],
  },
  {
    slug: 'pecorino-sardo',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    parentSlug: 'pecorino',
    names: { ru: 'Пекорино Сардо', en: 'Pecorino Sardo', fr: 'Pecorino Sardo' },
    aliases: {
      ru: ['сардинский пекорино'],
      en: ['sardinian pecorino'],
      fr: ['pécorino sarde'],
    },
    allergens: ['milk'],
  },
  {
    slug: 'fontal',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Фонталь', en: 'Fontal', fr: 'Fontal' },
    aliases: { ru: ['фонтал'], en: ['fontal cheese'], fr: [] },
    allergens: ['milk'],
  },
  {
    slug: 'gorgonzola',
    categorySlug: 'dairy',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Горгонзола', en: 'Gorgonzola', fr: 'Gorgonzola' },
    aliases: {
      ru: ['горгондзола', 'горгонцола'],
      en: ['gorgonzola dolce', 'blue cheese'],
      fr: ['gorgonzola doux'],
    },
    allergens: ['milk'],
  },

  // --- Deli --------------------------------------------------------------
  {
    slug: 'pepperoni',
    categorySlug: 'deli',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Пепперони', en: 'Pepperoni', fr: 'Pepperoni' },
    aliases: {
      ru: ['пеперони', 'колбаса пепперони'],
      en: ['pepperoni sausage'],
      fr: ['saucisson pepperoni'],
    },
  },
  {
    slug: 'mortadella',
    categorySlug: 'deli',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Мортаделла', en: 'Mortadella', fr: 'Mortadelle' },
    aliases: {
      ru: ['мортадела'],
      en: ['mortadella bologna'],
      fr: ['mortadelle de bologne'],
    },
    allergens: ['pistachio'],
  },
  {
    slug: 'italian-sausage',
    categorySlug: 'deli',
    measure: 'mass',
    baseUnit: 'g',
    names: {
      ru: 'Итальянская колбаска',
      en: 'Italian sausage',
      fr: 'Saucisse italienne',
    },
    aliases: {
      ru: ['салсичча', 'колбаска'],
      en: ['salsiccia', 'sausage'],
      fr: ['salsiccia', 'saucisse'],
    },
    notes: {
      ru: 'Конкретный вид не указан пользователем — требуется уточнение.',
      en: 'The specific kind was never stated by the user and needs confirmation.',
    },
  },
  {
    slug: 'nduja',
    categorySlug: 'deli',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Ндуйя', en: "'Nduja", fr: "'Nduja" },
    aliases: { ru: ['ндуя'], en: ['nduja'], fr: ['nduja'] },
  },
  {
    slug: 'soppressata',
    categorySlug: 'deli',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Соппрессата', en: 'Soppressata', fr: 'Soppressata' },
    aliases: { ru: ['супрессата'], en: ['sopressata'], fr: [] },
  },

  // --- Produce and herbs -------------------------------------------------
  {
    slug: 'basil-fresh',
    categorySlug: 'herbs',
    measure: 'count',
    baseUnit: 'leaf',
    names: { ru: 'Базилик свежий', en: 'Fresh basil', fr: 'Basilic frais' },
    aliases: {
      ru: ['базилик', 'зелёный базилик'],
      en: ['basil', 'genovese basil', 'sweet basil'],
      fr: ['basilic', 'basilic génois'],
    },
  },
  {
    slug: 'garlic',
    categorySlug: 'produce',
    measure: 'count',
    baseUnit: 'clove',
    names: { ru: 'Чеснок', en: 'Garlic', fr: 'Ail' },
    aliases: { ru: ['чеснок свежий'], en: ['garlic clove'], fr: ["gousse d'ail"] },
  },
  {
    slug: 'arugula',
    categorySlug: 'produce',
    measure: 'mass',
    baseUnit: 'g',
    names: { ru: 'Руккола', en: 'Arugula', fr: 'Roquette' },
    // The four-way alias set the spec calls out by name.
    aliases: {
      ru: ['рукола', 'рукколла'],
      en: ['rocket', 'rucola', 'roquette', 'arugula'],
      fr: ['roquette', 'rucola'],
    },
  },
  {
    slug: 'pear',
    categorySlug: 'produce',
    measure: 'count',
    baseUnit: 'piece',
    names: { ru: 'Груша', en: 'Pear', fr: 'Poire' },
    aliases: { ru: ['груши'], en: ['pears'], fr: ['poires'] },
  },
  {
    slug: 'chili-flakes',
    categorySlug: 'pantry',
    measure: 'mass',
    baseUnit: 'g',
    names: {
      ru: 'Хлопья острого перца',
      en: 'Chili flakes',
      fr: 'Flocons de piment',
    },
    aliases: {
      ru: ['перец чили', 'острый перец'],
      en: ['red pepper flakes', 'peperoncino'],
      fr: ['piment', 'peperoncino'],
    },
  },
]

export const packageOptions: SeedPackageOption[] = [
  {
    slug: 'pkg-pelati-400',
    ingredientSlug: 'tomatoes-whole-peeled-canned',
    packageType: 'can',
    netAmount: amt(400, 'g'),
    preferred: true,
    labels: { ru: 'Банка 400 г', en: '400 g can', fr: 'Boîte 400 g' },
  },
  {
    slug: 'pkg-pelati-800',
    ingredientSlug: 'tomatoes-whole-peeled-canned',
    packageType: 'can',
    netAmount: amt(800, 'g'),
    labels: { ru: 'Банка 800 г', en: '800 g can', fr: 'Boîte 800 g' },
  },
  {
    slug: 'pkg-mozzarella-125',
    ingredientSlug: 'mozzarella-fior-di-latte',
    packageType: 'pack',
    netAmount: amt(125, 'g'),
    preferred: true,
    labels: { ru: 'Шарик 125 г', en: '125 g ball', fr: 'Boule 125 g' },
  },
  {
    slug: 'pkg-bufala-125',
    ingredientSlug: 'mozzarella-di-bufala',
    packageType: 'pack',
    netAmount: amt(125, 'g'),
    preferred: true,
    labels: { ru: 'Шарик 125 г', en: '125 g ball', fr: 'Boule 125 g' },
  },
  {
    slug: 'pkg-evoo-500',
    ingredientSlug: 'olive-oil-extra-virgin',
    packageType: 'bottle',
    netAmount: amt(500, 'ml'),
    preferred: true,
    labels: { ru: 'Бутылка 500 мл', en: '500 ml bottle', fr: 'Bouteille 500 ml' },
  },
  {
    slug: 'pkg-flour-00-1kg',
    ingredientSlug: 'flour-type-00',
    packageType: 'bag',
    netAmount: amt(1, 'kg'),
    preferred: true,
    labels: { ru: 'Пакет 1 кг', en: '1 kg bag', fr: 'Sachet 1 kg' },
  },
  {
    slug: 'pkg-flour-0-1kg',
    ingredientSlug: 'flour-type-0',
    packageType: 'bag',
    netAmount: amt(1, 'kg'),
    preferred: true,
    labels: { ru: 'Пакет 1 кг', en: '1 kg bag', fr: 'Sachet 1 kg' },
  },
  {
    slug: 'pkg-yeast-7',
    ingredientSlug: 'yeast-active-dry',
    packageType: 'pack',
    netAmount: amt(7, 'g'),
    preferred: true,
    labels: { ru: 'Пакетик 7 г', en: '7 g sachet', fr: 'Sachet 7 g' },
  },
  {
    slug: 'pkg-pine-nuts-100',
    ingredientSlug: 'pine-nuts',
    packageType: 'pack',
    netAmount: amt(100, 'g'),
    preferred: true,
    labels: { ru: 'Упаковка 100 г', en: '100 g pack', fr: 'Sachet 100 g' },
  },
  {
    slug: 'pkg-parmesan-200',
    ingredientSlug: 'parmigiano-reggiano',
    packageType: 'pack',
    netAmount: amt(200, 'g'),
    preferred: true,
    labels: { ru: 'Кусок 200 г', en: '200 g piece', fr: 'Morceau 200 g' },
  },
  {
    slug: 'pkg-arugula-125',
    ingredientSlug: 'arugula',
    packageType: 'bag',
    netAmount: amt(125, 'g'),
    preferred: true,
    labels: { ru: 'Пакет 125 г', en: '125 g bag', fr: 'Sachet 125 g' },
  },
]

/**
 * Substitutions are a curated allow-list, never a generic fallback.
 *
 * Only stylistically defensible swaps are approved. The deliberately
 * unapproved rows at the end exist so the engine has something concrete to
 * refuse: the app must never answer "no tomato sauce" with "use ketchup".
 */
export const substitutions: SeedSubstitution[] = [
  {
    fromSlug: 'mozzarella-fior-di-latte',
    toSlug: 'mozzarella-di-bufala',
    styleSlug: null,
    qualityGrade: 'equivalent',
    approved: true,
    explanations: {
      ru: 'Буфала более влажная и насыщенная; подсушите её перед выпечкой.',
      en: 'Bufala is wetter and richer; drain it well before baking.',
      fr: 'La bufflonne est plus humide; égouttez-la bien avant la cuisson.',
    },
  },
  {
    fromSlug: 'mozzarella-di-bufala',
    toSlug: 'mozzarella-fior-di-latte',
    styleSlug: null,
    qualityGrade: 'equivalent',
    approved: true,
    explanations: {
      ru: 'Фиор ди латте суше и стабильнее в домашней духовке.',
      en: 'Fior di latte is drier and behaves better in a home oven.',
      fr: 'Le fior di latte est plus sec et tient mieux au four domestique.',
    },
  },
  {
    fromSlug: 'pecorino-sardo',
    toSlug: 'pecorino',
    styleSlug: null,
    qualityGrade: 'good',
    approved: true,
    explanations: {
      ru: 'Пекорино Романо солонее — уменьшите количество соли.',
      en: 'Pecorino Romano is saltier, so cut back on added salt.',
      fr: 'Le pecorino romano est plus salé; réduisez le sel ajouté.',
    },
  },
  {
    fromSlug: 'pepperoni',
    toSlug: 'soppressata',
    styleSlug: null,
    qualityGrade: 'good',
    approved: true,
    explanations: {
      ru: 'Соппрессата даёт схожий пряный профиль и хорошо подрумянивается.',
      en: 'Soppressata gives a comparable spiced profile and crisps well.',
      fr: 'La soppressata offre un profil épicé comparable et croustille bien.',
    },
  },
  {
    fromSlug: 'pepperoni',
    toSlug: 'nduja',
    styleSlug: null,
    qualityGrade: 'acceptable',
    approved: true,
    explanations: {
      ru: 'Ндуйя намного острее и мягче по текстуре — кладите меньше.',
      en: "'Nduja is far spicier and spreadable, so use noticeably less.",
      fr: "La 'nduja est bien plus piquante et tartinable; dosez moins.",
    },
  },
  {
    fromSlug: 'flour-type-00',
    toSlug: 'flour-type-0',
    styleSlug: null,
    qualityGrade: 'good',
    approved: true,
    explanations: {
      ru: 'Мука типа 0 немного грубее и впитывает чуть больше воды.',
      en: 'Type 0 is slightly coarser and takes a little more water.',
      fr: 'La type 0 est un peu plus rustique et absorbe un peu plus d’eau.',
    },
  },
  // Explicitly rejected. Kept in the catalog so the reason is visible in the
  // UI rather than the swap simply being absent.
  {
    fromSlug: 'tomatoes-whole-peeled-canned',
    toSlug: 'chili-flakes',
    styleSlug: null,
    qualityGrade: 'last_resort',
    approved: false,
    explanations: {
      ru: 'Не замена: без томатов лучше добавить их в список покупок.',
      en: 'Not a substitute: if there are no tomatoes, add them to the shopping list.',
      fr: 'Pas un substitut : sans tomates, ajoutez-en à la liste de courses.',
    },
  },
]

export const styles: SeedStyle[] = [
  {
    slug: 'napoletana',
    names: { ru: 'Неаполитанская', en: 'Neapolitan', fr: 'Napolitaine' },
    descriptions: {
      ru: 'Высокий воздушный бортик, короткая выпечка при очень высокой температуре.',
      en: 'A puffed, airy cornicione and a very short bake at very high heat.',
      fr: 'Une corniche aérée et une cuisson très courte à très haute température.',
    },
  },
  {
    slug: 'romana-tonda',
    names: { ru: 'Римская тонда', en: 'Roman tonda', fr: 'Romaine tonda' },
    descriptions: {
      ru: 'Тонкая, хрустящая круглая пицца, раскатанная скалкой.',
      en: 'A thin, crisp round pizza rolled out rather than hand-stretched.',
      fr: 'Une pizza ronde fine et croustillante, étalée au rouleau.',
    },
  },
  {
    slug: 'romana-teglia',
    names: { ru: 'Римская в противне', en: 'Roman in teglia', fr: 'Romaine en plaque' },
    descriptions: {
      ru: 'Прямоугольная пицца в противне с высокой гидратацией и открытым мякишем.',
      en: 'A high-hydration rectangular pan pizza with an open crumb.',
      fr: 'Une pizza rectangulaire en plaque, très hydratée, à mie ouverte.',
    },
  },
  {
    slug: 'contemporanea',
    names: { ru: 'Современная', en: 'Contemporary', fr: 'Contemporaine' },
    descriptions: {
      ru: 'Современная итальянская школа: длинная ферментация, выраженный бортик.',
      en: 'The modern Italian school: long fermentation and a pronounced rim.',
      fr: "L'école italienne moderne : longue fermentation et corniche marquée.",
    },
  },
]

export const ovenProfiles: SeedOvenProfile[] = [
  {
    slug: 'home-oven',
    maxTemperatureC: 250,
    names: { ru: 'Домашняя духовка', en: 'Home oven', fr: 'Four domestique' },
  },
  {
    slug: 'home-oven-steel',
    maxTemperatureC: 300,
    names: {
      ru: 'Домашняя духовка со сталью',
      en: 'Home oven with baking steel',
      fr: 'Four domestique avec plaque acier',
    },
  },
  {
    slug: 'pizza-oven',
    maxTemperatureC: 450,
    names: {
      ru: 'Электрическая печь для пиццы',
      en: 'Electric pizza oven',
      fr: 'Four à pizza électrique',
    },
  },
  {
    slug: 'wood-fired',
    maxTemperatureC: 485,
    names: { ru: 'Дровяная печь', en: 'Wood-fired oven', fr: 'Four à bois' },
  },
]
