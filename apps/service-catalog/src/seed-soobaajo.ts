/**
 * SOOBAAJO equipment sheets (assets/*.pdf + supplier flyers).
 *
 * Description format, parsed by the vitrine (apps/web/src/lib/productContent.ts):
 *   text before the first "## " = summary · "## Title" = section · "### Title" = spec group
 *   "- item" = bullet · "Label | Value" = spec row · any other line = paragraph
 */
export type SeedProduct = {
  slug: string;
  name: string;
  description: string;
  price: number;
  category: string;
  images: string[];
};

const BATTERY_PROTECTIONS = `## Protections intégrées
- Connexion Bluetooth
- Protection contre les courts-circuits
- Protection thermique
- Protection contre les surtensions de charge
- Protection contre les sous-tensions de décharge
- Protection contre les surintensités de charge et de décharge (OC/OD)`;

const BATTERY_LIFE_CURVE = `## Durée de vie selon la profondeur de décharge
Courbes mesurées à 0,5C et 25 °C, jusqu’à 80 % de capacité restante :
- Environ 8000 cycles à 50 % de profondeur de décharge (DOD)
- Environ 6000 cycles à 80 % DOD
- Environ 4000 cycles à 100 % DOD`;

const BATTERY_FEATURES_REPLACED = `## Points forts
- Longue durée de vie : 6000 cycles et plus
- Haute densité énergétique et excellente sécurité
- Tension de décharge stable, faible autodécharge
- Protection intelligente par BMS
- Bluetooth et écran LCD configurables
- Large plage de température : -20 °C à 60 °C`;

const BATTERY_APPLICATIONS_SHORT = `## Applications
- Alimentation de secours (UPS)
- Véhicules et mobilité électriques
- Systèmes incendie et sécurité
- Éclairage`;

const BATTERY_APPLICATIONS_FULL = `## Applications
- Stockage d’énergie solaire et éolienne
- Équipements de télécommunication
- Systèmes d’alimentation de secours
- Équipements médicaux
- Onduleurs / alimentation sans interruption (UPS)
- Véhicules et mobilité électriques
- Systèmes incendie et sécurité
- Éclairage`;

const BATTERY_ENVIRONMENT_ROWS = `Température de fonctionnement | Charge : 0 °C à +50 °C · Décharge : -20 °C à +60 °C
Humidité relative | 0 à 95 %
Température de stockage | Moins de 3 mois : -10 °C à 25 °C · Moins d’un an : 0 °C à 25 °C
Altitude maximale de fonctionnement | 2000 m
Indice de protection | IP20`;

const batteryNotes = (cellVoltage: string) => `## Remarques
Conditions de test : tension de cellule ${cellVoltage}, batterie neuve à +25 ±2 °C, charge et décharge à 0,5C. La puissance disponible peut varier selon l’onduleur utilisé.
Le courant et la puissance nominaux de charge/décharge varient selon la température et l’état de charge (SOC).
Caractéristiques susceptibles d’être modifiées sans préavis.`;

type ReplacedBattery = {
  voltage: string;
  capacity: string;
  energy: string;
  combination: string;
  bms: string;
  voltageRange: string;
  ratedPower: string;
  peakPower: string;
  shortCircuit: string;
  parallel: string;
  weight: string;
  dimensions: string;
  applications: string;
};

function replacedBattery(b: ReplacedBattery): string {
  return `Batterie lithium fer phosphate (LiFePO4) SOOBAAJO de la série Lithium Replaced : ${b.voltage} – ${b.capacity}, soit ${b.energy} d’énergie disponible.
Plus de 6000 cycles de vie, BMS intelligent intégré et tension de décharge stable pour vos installations solaires, alimentations de secours et équipements mobiles.

${BATTERY_FEATURES_REPLACED}

${BATTERY_PROTECTIONS}

${b.applications}

${BATTERY_LIFE_CURVE}

## Caractéristiques techniques
### Électrique
Énergie disponible | ${b.energy}
Capacité nominale | ${b.capacity}
Configuration des cellules | ${b.combination}
Configuration BMS | ${b.bms}
Tension nominale | ${b.voltage}
Plage de tension de fonctionnement | ${b.voltageRange}
Courant nominal de charge/décharge | 75 A
Courant de crête | 150 A en continu · 155 A pendant 10 s
Puissance nominale de charge/décharge | ${b.ratedPower}
Puissance de crête | ${b.peakPower}
Courant de court-circuit | ${b.shortCircuit}
Durée de vie | 6000 cycles et plus (80 % DOD, 25 °C)
### Communication
Mode de communication | Non
Mise en parallèle | ${b.parallel}
Données à distance | Non
Afficheur batterie | Non
### Physique et environnement
Poids | ${b.weight}
Dimensions (L × l × H) | ${b.dimensions}
${BATTERY_ENVIRONMENT_ROWS}
Mode d’installation | Posée au sol
Sortie des câbles | Capot supérieur
Normes et certifications | MSDS, UN38.3

${batteryNotes('2,5 V à 3,65 V')}`;
}

const INVERTER_OPERATING_MODES = `## Modes de fonctionnement
- Mode A : panneaux PV, réseau et batterie connectés
- Mode B : panneaux PV et batterie, sans réseau
- Mode C : panneaux PV seuls, sans réseau ni batterie
- Mode D : panneaux PV et réseau, sans batterie`;

const INVERTER_SYSTEM = `## Schéma d’installation
Les panneaux PV alimentent l’onduleur, qui dessert les charges (éclairage, télévision, ventilateur, réfrigérateur…) en combinant le réseau électrique et une batterie plomb ou lithium.
Supervision possible via module WiFi/GPRS, application iOS/Android et interface web.`;

const INVERTER_PORTS_7 = `## Connexions (vue de dessous)
- 1. Entrée AC
- 2. Sortie AC
- 3. Entrée PV
- 4. Entrée batterie
- 5. Port de communication RS232 / RS485
- 6. Mise à la terre
- 7. Interrupteur marche/arrêt`;

const INVERTER_COMMON_FEATURES = `- Onde sinusoïdale pure
- Facteur de puissance 1,0
- Fonctionne sans batterie
- Cache anti-poussière amovible pour environnements difficiles
- Surveillance à distance par WiFi (en option)
- Priorités de sortie multiples : UTL, SOL, SBU, SUB
- Fonction EQ (égalisation) pour optimiser les performances et prolonger la durée de vie de la batterie`;

const INVERTER_NOTE = `## Remarques
Caractéristiques susceptibles d’être modifiées sans préavis.`;

export const SOOBAAJO_PRODUCTS: SeedProduct[] = [
  {
    slug: 'soo-12-8v-200ah',
    name: 'Batterie lithium SOO-12.8V 200AH (2,56 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-12-8v-200ah.webp'],
    description: replacedBattery({
      voltage: '12,8 V',
      capacity: '200 Ah',
      energy: '2,56 kWh',
      combination: '4S1P',
      bms: '4S150A',
      voltageRange: '10 V à 14,6 V',
      ratedPower: '1,28 kW',
      peakPower: '1,92 kW en continu · 1,984 kW pendant 10 s',
      shortCircuit: '0,6 kA à 100 µs',
      parallel: 'Jusqu’à 4 en série et 4 en parallèle',
      weight: '22 kg (±3 %)',
      dimensions: '320 × 225 × 260 mm',
      applications: BATTERY_APPLICATIONS_SHORT,
    }),
  },
  {
    slug: 'soo-12-8v-300ah',
    name: 'Batterie lithium SOO-12.8V 300AH (3,84 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-12-8v-300ah.webp'],
    description: replacedBattery({
      voltage: '12,8 V',
      capacity: '300 Ah',
      energy: '3,84 kWh',
      combination: '4S1P',
      bms: '4S150A',
      voltageRange: '10 V à 14,6 V',
      ratedPower: '1,92 kW',
      peakPower: '1,92 kW en continu · 1,984 kW pendant 10 s',
      shortCircuit: '0,72 kA à 100 µs',
      parallel: 'Jusqu’à 4 en série et 4 en parallèle',
      weight: '32 kg (±3 %)',
      dimensions: '385 × 200 × 260 mm',
      applications: BATTERY_APPLICATIONS_FULL,
    }),
  },
  {
    slug: 'soo-25-6v-200ah',
    name: 'Batterie lithium SOO-25.6V 200AH (5,12 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-25-6v-200ah.webp'],
    description: replacedBattery({
      voltage: '25,6 V',
      capacity: '200 Ah',
      energy: '5,12 kWh',
      combination: '8S1P',
      bms: '8S150A',
      voltageRange: '20 V à 29,2 V',
      ratedPower: '2,56 kW',
      peakPower: '3,84 kW en continu · 3,968 kW pendant 10 s',
      shortCircuit: '0,54 kA à 100 µs',
      parallel: 'Jusqu’à 2 en série et 2 en parallèle',
      weight: '41 kg (±3 %)',
      dimensions: '435 × 230 × 260 mm',
      applications: BATTERY_APPLICATIONS_FULL,
    }),
  },
  {
    slug: 'soo-25-6v-300ah',
    name: 'Batterie lithium SOO-25.6V 300AH (7,68 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-25-6v-300ah.webp'],
    description: replacedBattery({
      voltage: '25,6 V',
      capacity: '300 Ah',
      energy: '7,68 kWh',
      combination: '8S1P',
      bms: '8S150A',
      voltageRange: '20 V à 29,2 V',
      ratedPower: '3,84 kW',
      peakPower: '3,84 kW en continu · 3,968 kW pendant 10 s',
      shortCircuit: '0,428 kA à 100 µs',
      parallel: 'Jusqu’à 2 en série et 2 en parallèle',
      weight: '57 kg (±3 %)',
      dimensions: '435 × 340 × 270 mm',
      applications: BATTERY_APPLICATIONS_SHORT,
    }),
  },
  {
    slug: 'soo-51-2v-200ah',
    name: 'Batterie murale LiFePO4 SOO-51.2V 200AH (10,24 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-51-2v-200ah.webp'],
    description: `Batterie murale lithium fer phosphate (LiFePO4) SOOBAAJO 51,2 V – 200 Ah, soit 10,24 kWh d’énergie disponible.
Extensible jusqu’à 16 unités en parallèle et compatible avec la plupart des grandes marques d’onduleurs, pour le stockage résidentiel et professionnel.

## Points forts
- Extension en parallèle jusqu’à 16 batteries
- Compatible avec de nombreuses marques d’onduleurs du marché
- Installation murale ou au sol
- BMS intégré pour protéger et prolonger la durée de vie de la batterie
- Sécurité excellente : cellules lithium fer phosphate de haute qualité
- Personnalisation possible

${BATTERY_PROTECTIONS}

${BATTERY_APPLICATIONS_FULL}

${BATTERY_LIFE_CURVE}

## Caractéristiques techniques
### Électrique
Énergie disponible | 10,24 kWh
Capacité nominale | 200 Ah
Configuration des cellules | 16S1P
Configuration BMS | 16S200A
Tension nominale | 51,2 V
Plage de tension de fonctionnement | 41,6 V à 58,4 V
Courant nominal de charge/décharge | 100 A
Courant de crête | 200 A en continu · 250 A pendant 500 ms
Puissance nominale de charge/décharge | 5,12 kW
Puissance de crête | 10,24 kW en continu · 12,8 kW pendant 500 ms
Courant de court-circuit | 0,6 kA à 100 µs
Durée de vie | 6000 cycles et plus (80 % DOD, 25 °C)
### Communication
Mode de communication | CAN, RS485, RS232
Mise en parallèle | 6 unités recommandées (16 au maximum)
Données à distance | Bluetooth / WiFi (en option)
Onduleurs compatibles | SMA, Growatt, TBB, Deye, GoodWe, Huawei, Schneider, Victron Energy, SOFAR, INVT
### Physique et environnement
Poids | 84 kg (±3 %)
Dimensions (L × l × H) | 410 × 240 × 640 mm
${BATTERY_ENVIRONMENT_ROWS}
Mode d’installation | Murale ou au sol
Sortie des câbles | Par le haut
Normes et certifications | MSDS, UN38.3

${batteryNotes('2,6 V à 3,65 V')}`,
  },
  {
    slug: 'soo-51-2v-300ah',
    name: 'Batterie au sol LiFePO4 SOO-51.2V 300AH (15,36 kWh)',
    price: 0,
    category: 'batteries',
    images: ['/products/soo-51-2v-300ah.webp'],
    description: `Batterie lithium fer phosphate (LiFePO4) SOOBAAJO à poser au sol, 51,2 V – 300 Ah, soit 15,36 kWh d’énergie disponible.
La plus grande capacité de la gamme, avec communication CAN/RS485/RS232 et mise en parallèle jusqu’à 16 unités pour les installations exigeantes.

## Points forts
- Performances fiables sur 6000 cycles et plus
- Compatible avec de nombreuses marques d’onduleurs du marché
- BMS intégré pour protéger et prolonger la durée de vie de la batterie
- Sécurité excellente : cellules lithium fer phosphate de haute qualité
- Large plage de température : -20 °C à 60 °C
- Personnalisation possible

${BATTERY_PROTECTIONS}

${BATTERY_APPLICATIONS_FULL}

${BATTERY_LIFE_CURVE}

## Caractéristiques techniques
### Électrique
Énergie disponible | 15,36 kWh
Capacité nominale | 300 Ah
Configuration des cellules | 16S1P
Configuration BMS | 16S200A
Tension nominale | 51,2 V
Plage de tension de fonctionnement | 41,6 V à 58,4 V
Courant nominal de charge/décharge | 150 A
Courant de crête | 200 A en continu · 250 A pendant 500 ms
Puissance nominale de charge/décharge | 7,68 kW
Puissance de crête | 10,24 kW en continu · 12,8 kW pendant 500 ms
Courant de court-circuit | 0,762 kA à 100 µs
Durée de vie | 6000 cycles et plus (80 % DOD, 25 °C)
### Communication
Mode de communication | CAN, RS485, RS232
Mise en parallèle | 6 unités recommandées (16 au maximum)
Données à distance | Bluetooth / WiFi (en option)
Onduleurs compatibles | SMA, Growatt, TBB, Deye, GoodWe, Huawei, Schneider, Victron Energy, SOFAR, INVT
### Physique et environnement
Poids | 121 kg (±3 %)
Dimensions (L × l × H) | 550 × 270 × 815 mm
${BATTERY_ENVIRONMENT_ROWS}
Mode d’installation | Au sol
Sortie des câbles | Sur le côté
Normes et certifications | MSDS, UN38.3

${batteryNotes('2,6 V à 3,65 V')}`,
  },
  {
    slug: 'soo-1kw',
    name: 'Onduleur solaire off-grid SOO-1KW',
    price: 0,
    category: 'onduleurs',
    images: ['/products/soo-1kw.webp'],
    description: `Onduleur solaire hors réseau (off-grid) SOOBAAJO 1 kW, sortie 220/230 VAC, série EM (PV 30–150 Vdc).
Onde sinusoïdale pure, chargeur solaire MPPT 40 A intégré et rendement jusqu’à 98 % : l’énergie solaire alimente vos appareils en priorité.

## Points forts
- Onduleur solaire à onde sinusoïdale pure
- Chargeur solaire MPPT 40 A intégré
- Plage de tension d’entrée PV : 20–150 VDC (version 1000 W), 30–150 VDC (version 1500 W)
- Kit anti-poussière intégré pour environnements difficiles
- Gestion intelligente de la charge pour optimiser la durée de vie de la batterie
- Répond à de nombreuses demandes de personnalisation
- L’énergie solaire alimente les charges en priorité

## Caractéristiques techniques
### Général
Puissance | 1 kW
Tension de sortie | 220/230 VAC
Type | Onduleur solaire off-grid, onde sinusoïdale pure
Rendement maximal | 98 %
Indice de protection | IP21
### Chargeur solaire
Régulateur | MPPT 40 A
Plage de tension PV | 20–150 VDC (1000 W) · 30–150 VDC (1500 W)
### Équipement
Prise de sortie | Prise de courant intégrée
Protection | Anti-poussière
Affichage | Écran LCD

${INVERTER_NOTE}`,
  },
  {
    slug: 'soo-3-5kw',
    name: 'Onduleur solaire off-grid SOO-3.5KW (24 V)',
    price: 0,
    category: 'onduleurs',
    images: ['/products/soo-3-5kw.webp'],
    description: `Onduleur solaire off-grid SOOBAAJO 3,5 kW (modèle CM3500-24N), sortie 220/230 VAC, série CM (PV 30–500 Vdc), pour batterie 24 V.
Chargeur MPPT jusqu’à 4000 W de panneaux, 7000 VA en pointe et fonctionnement possible sans batterie.

## Points forts
${INVERTER_COMMON_FEATURES}
- Plage de tension PV : 30–500 Vdc
- Chargeur solaire MPPT intégré, jusqu’à 100 A
- Bornes de raccordement anti-choc

## Connexions (vue de dessous)
- 1. Entrée AC
- 2. Sortie AC
- 3. Entrée PV
- 4. Entrée batterie
- 5. Mise à la terre

${INVERTER_SYSTEM}

${INVERTER_OPERATING_MODES}

## Caractéristiques techniques
### Général
Modèle | CM3500-24N
Puissance | 3500 W
Mise en parallèle | Non
Activation de batterie lithium | Non
Communication batterie lithium | Non
### Entrée
Tension nominale | 230 VAC
Plage de tension acceptée | 170–280 VAC (mode ordinateur) · 90–280 VAC (mode appareils ménagers)
Fréquence | 50/60 Hz (détection automatique)
### Sortie
Tension nominale | 220/230 VAC ±5 %
Puissance nominale | 3500 W
Puissance en mode batterie | 3000 W
Puissance de pointe | 7000 VA
Fréquence | 50/60 Hz
Forme d’onde | Sinusoïdale pure
Temps de transfert | 10 ms (mode ordinateur) · 20 ms (mode appareils ménagers)
Rendement max (PV vers onduleur) | 96 %
Rendement max (batterie vers onduleur) | 93 %
Protection contre les surcharges | 5 s à 140 % de charge et plus · 10 s entre 100 % et 140 %
Facteur de crête | 3:1
Facteur de puissance admissible | 0,6 à 1 (inductif ou capacitif)
### Batterie
Tension batterie | 24 Vdc
Tension de floating | 27 Vdc
Protection contre les surtensions de charge | 32 Vdc
Méthode de charge | CC/CV
### Chargeur solaire et chargeur AC
Type de chargeur solaire | MPPT
Puissance PV maximale | 4000 W
Tension PV maximale en circuit ouvert | 500 VDC
Plage de tension MPPT | 30–500 VDC
Courant d’entrée solaire maximal | 15 A
Courant de charge solaire maximal | 100 A
Courant de charge AC maximal | 60 A
Courant de charge maximal (AC + PV) | 100 A
### Physique
Dimensions (P × L × H) | 330 × 278 × 98 mm
Dimensions de l’emballage (P × L × H) | 400 × 365 × 174 mm
Poids net | 3,95 kg
Interface de communication | RJ45 pour WiFi
### Environnement
Température de fonctionnement | -10 °C à 55 °C
Température de stockage | -15 °C à 60 °C
Humidité | 5 % à 95 % d’humidité relative (sans condensation)
Indice de protection | IP21

${INVERTER_NOTE}`,
  },
  {
    slug: 'soo-6-2kw',
    name: 'Onduleur solaire off-grid SOO-6.2KW (48 V)',
    price: 0,
    category: 'onduleurs',
    images: ['/products/soo-6-2kw.webp'],
    description: `Onduleur solaire off-grid SOOBAAJO 6,2 kW (modèle EM6200-48L), sortie 220/230 VAC, série EM (PV 60–500 Vdc), pour batterie 48 V.
Jusqu’à 6500 W de panneaux, 12400 VA en pointe, communication RS485 avec les batteries lithium et rendement de 96 %.

## Points forts
- Activation de la batterie lithium par le PV
- Compatible avec les batteries LiFePO4 via RS485
${INVERTER_COMMON_FEATURES}
- Tension d’entrée PV : 60–500 Vdc
- Chargeur solaire MPPT intégré, jusqu’à 120 A
- Haut rendement

${INVERTER_PORTS_7}

${INVERTER_SYSTEM}

${INVERTER_OPERATING_MODES}

## Caractéristiques techniques
### Général
Modèle | EM6200-48L
Puissance | 6,2 kVA / 6,2 kW
Mise en parallèle | Non
Activation de batterie lithium | Oui (par le PV uniquement)
Communication batterie lithium | Oui (RS485)
### Entrée
Tension nominale | 230 VAC
Plage de tension acceptée | 170–280 VAC (mode ordinateur) · 90–280 VAC (mode appareils ménagers)
Fréquence | 50/60 Hz (détection automatique)
### Sortie
Tension nominale | 220/230 VAC ±5 %
Puissance de pointe | 12400 VA
Fréquence | 50/60 Hz
Forme d’onde | Sinusoïdale pure
Temps de transfert | 10 ms (mode ordinateur) · 20 ms (mode appareils ménagers)
Rendement max (PV vers onduleur) | 96 %
Rendement max (batterie vers onduleur) | 93 %
Protection contre les surcharges | 5 s à 140 % de charge et plus · 10 s entre 110 % et 140 %
Facteur de crête | 3:1
Facteur de puissance admissible | 0,6 à 1 (inductif ou capacitif)
### Batterie
Tension batterie | 48 VDC
Tension de floating | 54 VDC
Protection contre les surtensions de charge | 63 VDC
Méthode de charge | CC/CV
### Chargeur solaire et chargeur AC
Type de chargeur solaire | MPPT
Puissance PV maximale | 6500 W
Tension PV maximale en circuit ouvert | 500 VDC
Plage de tension MPPT | 60–500 VDC
Courant d’entrée solaire maximal | 27 A
Courant de charge solaire maximal | 120 A
Courant de charge AC maximal | 80 A
Courant de charge maximal (AC + PV) | 120 A
### Physique
Dimensions (P × L × H) | 438 × 295 × 105 mm
Dimensions de l’emballage (P × L × H) | 560 × 375 × 185 mm
Poids net | 9 kg
Interface de communication | RS232 + RS485
### Environnement
Température de fonctionnement | -10 °C à 50 °C
Température de stockage | -15 °C à 50 °C
Humidité | 5 % à 95 % d’humidité relative (sans condensation)

${INVERTER_NOTE}`,
  },
  {
    slug: 'soo-11kw',
    name: 'Onduleur solaire off-grid SOO-11KW',
    price: 0,
    category: 'onduleurs',
    images: ['/products/soo-11kw.webp'],
    description: `Onduleur solaire off-grid SOOBAAJO 11 kW, sortie 220/230 VAC, série EM (PV 60–500 Vdc).
La puissance la plus élevée de la gamme : facteur de puissance 1,0, communication RS232/RS485 et activation des batteries lithium par le PV ou le réseau.

## Points forts
- Activation de la batterie lithium par le PV ou le réseau
- Compatible avec les batteries LiFePO4 via RS485
${INVERTER_COMMON_FEATURES}
- Tension d’entrée PV : 60–500 Vdc
- Chargeur solaire MPPT intégré 60 A / 100 A / 120 A
- Bornes de raccordement anti-choc

${INVERTER_PORTS_7}

${INVERTER_SYSTEM}

${INVERTER_OPERATING_MODES}

## Caractéristiques techniques
### Général
Puissance | 11 kW
Tension de sortie | 220/230 VAC
Forme d’onde | Sinusoïdale pure
Facteur de puissance | 1,0
### Chargeur solaire
Type de chargeur solaire | MPPT 60 A / 100 A / 120 A
Plage de tension PV | 60–500 Vdc
### Batterie et communication
Activation de batterie lithium | Par le PV ou le réseau
BMS | Compatible batteries lithium (LiFePO4) via RS485
Ports de communication | RS232, RS485
Supervision | WiFi (en option)

${INVERTER_NOTE}`,
  },
];
