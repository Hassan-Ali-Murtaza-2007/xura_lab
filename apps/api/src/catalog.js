export const catalogue = [
  {
    id: 1,
    slug: "arven",
    name: "Arven",
    tagline: "The art of leaving an impression.",
    gender: "Unisex",
    volumeMl: 50,
    price: 2500,
    imageUrl: "/images/arven-4k.jpg",
    images: ["/images/arven-4k.jpg"],
    sortOrder: 1,
    lead: "Deep. Bold. Distinctive.",
    description: "Built around the richness of oud, the warmth of amber and the refined depth of leather, Arven explores the darker, more commanding side of perfumery. Spicy accords bring intensity, and a subtle sweetness softens the composition.",
    notes: "Oud, spices, leather, amber",
    character: "Opulent, confident, grounded",
    bestFor: "Evening elegance, statement moments",
    variants: [
      { id: 101, concentrationPercent: 10, price: 2500, sortOrder: 1 },
      { id: 102, concentrationPercent: 20, price: 3500, sortOrder: 2 },
      { id: 103, concentrationPercent: 40, price: 5500, sortOrder: 3 }
    ]
  },
  {
    id: 2,
    slug: "velor",
    name: "Velor",
    tagline: "Beyond the ordinary.",
    gender: "Men",
    volumeMl: 50,
    price: 2500,
    imageUrl: "/images/velor-4k.jpg",
    images: ["/images/velor-4k.jpg"],
    sortOrder: 2,
    lead: "Warm. Refined. Unmistakable.",
    description: "Velor opens with bright bergamot before settling into the dry elegance of cedar and vetiver. A smooth layer of musk gives the fragrance warmth and presence, creating a clean composition with a quietly confident finish.",
    notes: "Bergamot, cedar, vetiver, musk",
    character: "Refined, assured, contemporary",
    bestFor: "Daily confidence, polished occasions",
    variants: [
      { id: 201, concentrationPercent: 10, price: 2500, sortOrder: 1 },
      { id: 202, concentrationPercent: 20, price: 3500, sortOrder: 2 },
      { id: 203, concentrationPercent: 40, price: 5500, sortOrder: 3 }
    ]
  },
  {
    id: 3,
    slug: "nyra",
    name: "Nyra",
    tagline: "A beautiful kind of obsession.",
    gender: "Women",
    volumeMl: 50,
    price: 2500,
    imageUrl: "/images/nyra-4k.jpg",
    images: ["/images/nyra-4k.jpg"],
    sortOrder: 3,
    lead: "Luminous. Soft. Captivating.",
    description: "Nyra pairs luminous white florals with the depth of roasted coffee and the softness of vanilla. Gentle musk rounds the composition, leaving a warm, memorable trail that feels intimate without fading into the familiar.",
    notes: "White florals, coffee, vanilla, musk",
    character: "Luminous, sensual, composed",
    bestFor: "Intimate evenings, memorable entrances",
    variants: [
      { id: 301, concentrationPercent: 10, price: 2500, sortOrder: 1 },
      { id: 302, concentrationPercent: 20, price: 3500, sortOrder: 2 },
      { id: 303, concentrationPercent: 40, price: 5500, sortOrder: 3 }
    ]
  },
  {
    id: 4,
    slug: "duo-nyra-arven",
    name: "Nyra & Arven Duo Bundle",
    tagline: "Two signature fragrances in one bespoke collection.",
    gender: "Bundles",
    volumeMl: 50,
    price: 5400,
    compareAtPrice: 6000,
    imageUrl: "/images/nyra-4k.jpg",
    images: ["/images/nyra-4k.jpg", "/images/arven-4k.jpg"],
    sortOrder: 4,
    lead: "Luminous white florals meet commanding oud.",
    description: "The Nyra & Arven Duo pairs contrasting profiles for a complete day-to-night fragrance wardrobe. Select your preferred concentration for both Nyra and Arven individually to tailor the set to your personal wear style.",
    notes: "Nyra: White florals, coffee, vanilla · Arven: Oud, spices, leather, amber",
    character: "Layered, contrasting, bespoke",
    bestFor: "Day-to-night styling, signature layering, luxury gifting",
    bundleItems: [
      {
        name: "Nyra",
        tagline: "Luminous white florals, roasted coffee & vanilla",
        volumeMl: 50,
        concentrations: [10, 20, 40],
        defaultConcentration: 20
      },
      {
        name: "Arven",
        tagline: "Rich oud, warm amber & refined leather",
        volumeMl: 50,
        concentrations: [10, 20, 40],
        defaultConcentration: 10
      }
    ],
    variants: [
      { id: 401, concentrationPercent: 10, price: 4500, compareAtPrice: 5000, sortOrder: 1 },
      { id: 402, concentrationPercent: 20, price: 5400, compareAtPrice: 6000, sortOrder: 2 },
      { id: 403, concentrationPercent: 40, price: 8100, compareAtPrice: 9000, sortOrder: 3 }
    ]
  }
];
