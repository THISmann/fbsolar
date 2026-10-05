/**
 * Aurora Power (Yufai Aurora) equipment sheets (assets2/*.pdf + supplier visuals).
 * Same description format as seed-soobaajo.ts.
 */
import type { SeedProduct } from './seed-soobaajo';

const LV_P3E_FEATURES = `- 2 trackers MPPT intégrés
- Compatible avec les modules PV 18 A
- Port de communication BMS intégré (RS485)
- Fonctionnement en parallèle jusqu’à 8 unités
- Puissance de crête hors réseau : surcharge de 200 % pendant 15 s
- Batterie lithium ou plomb-acide 48 V
- Indice de protection IP66
- Refroidissement par air forcé intelligent`;

const LV_P3E_MODES = `## Modes de fonctionnement
- Mode onduleur : les charges sont alimentées par la batterie
- Mode PV : l’énergie solaire alimente les charges et recharge la batterie
- Mode réseau : le réseau électrique prend le relais et recharge la batterie`;

const LV_P3E_PROTECTIONS = `### Protections
Protection contre l’inversion de polarité PV | Oui
Détection de la résistance d’isolement PV | Oui
Détection du courant résiduel | Oui
Protection contre les surintensités en sortie | Oui
Protection contre les courts-circuits en sortie | Oui
Protection contre les surtensions en sortie | Oui`;

const LV_P3E_STANDARDS = `### Normes
Sécurité / CEM | NBIT32004-2018, IEC62109, IEC61000, IS16169 & IS16221 (BIS)
Raccordement au réseau | IEC61727, EN50549-1, VDE-4105, NRS-097-2-1, OVE-Richtlinie R25, UNE217001/2, Ordinance No.140
Autres normes | IEC61683, IEC62116, EN50530, IEC60068`;

const LV_P3E_ENVIRONMENT = `Température de fonctionnement | -25 °C à 60 °C (déclassement au-delà de 45 °C)
Température de stockage | -30 °C à 65 °C
Humidité relative | 0 à 95 %
Altitude de fonctionnement | ≤ 4000 m (déclassement au-delà de 2000 m)
Refroidissement | Air forcé intelligent
Bruit | < 55 dB
Indice de protection | IP66
Topologie | Isolation haute fréquence (côté batterie)`;

const NOTE = `## Remarques
Conditions de test : charge/décharge à 0,5C, 25 °C, 80 % de profondeur de décharge (DOD).
Caractéristiques susceptibles d’être modifiées sans préavis.`;

export const AURORA_PRODUCTS: SeedProduct[] = [
  {
    slug: 'aurora-yf-lfp-30kwh',
    name: 'Batterie lithium Aurora YF-LFP-30kWh (51,2 V – 600 Ah)',
    price: 0,
    category: 'batteries',
    images: ['/products/aurora-yf-lfp-30kwh.webp'],
    description: `Batterie lithium fer phosphate (LiFePO4) Aurora Power de 30 kWh : 51,2 V – 600 Ah, en module posé au sol et monté sur roulettes.
BMS intelligent intégré, plus de 8000 cycles et compatibilité avec plus de 30 marques d’onduleurs, pour le stockage résidentiel et professionnel.

## Points forts
- Système de gestion de batterie (BMS) performant
- Compatible avec plus de 30 marques d’onduleurs
- Installation simple et flexible : module autoportant déplaçable sur roulettes
- 8000 cycles et plus
- Sûre et durable
- Performances fiables
- Écran LCD et communication CAN / RS485
- Jusqu’à 16 batteries en parallèle

## Caractéristiques techniques
### Électrique
Modèle | YF-LFP-30kWh
Type de batterie | LiFePO4
Énergie nominale | 30 kWh
Capacité nominale | 600 Ah
Tension nominale | 51,2 V
Plage de tension de fonctionnement | 44,8 V à 56 V
Courant de charge/décharge recommandé | 100 A
Courant de charge/décharge continu max. | 200 A
Courant de charge/décharge de crête (10 s) | 210 A
Mise en parallèle | Jusqu’à 16 unités
Profondeur de décharge (DOD) | 90 %
Durée de vie | 8000 cycles et plus
### Communication et protection
Afficheur | LCD
Communication | CAN / RS485
Protection | BMS intelligent intégré
Indice de protection | IP21
### Environnement
Température de fonctionnement (charge) | 0 °C à +60 °C
Température de fonctionnement (décharge) | -20 °C à +60 °C
Température de stockage (1 mois) | -30 °C à +45 °C
Température de stockage (6 mois) | -20 °C à +35 °C
Altitude | ≤ 2000 m
### Physique
Installation | Au sol (déplaçable sur roulettes)
Dimensions du produit | 868 × 270 × 1025 mm
Dimensions de l’emballage | 930 × 320 × 1175 mm
Poids du produit | Environ 256 kg
Poids emballé | Environ 290 kg
Garantie constructeur | 10 ans (charge/décharge 0,5C, 25 °C, 80 % DOD)

${NOTE}`,
  },
  {
    slug: 'aurora-yf-lv-p3e-12048',
    name: 'Onduleur hybride triphasé Aurora YF-LV-P3E-12048 (12 kW, 48 V)',
    price: 0,
    category: 'onduleurs',
    images: ['/products/aurora-yf-lv-p3e-12048.webp'],
    description: `Onduleur hybride triphasé Aurora Power de 12 kW pour batterie basse tension 48 V (lithium ou plomb-acide), sortie 380/400 V.
Jusqu’à 24 kW de panneaux sur 2 MPPT, fonctionnement raccordé au réseau ou en autonomie, mise en parallèle jusqu’à 8 unités et boîtier IP66.

## Points forts
- Courant d’entrée PV jusqu’à 36 A
${LV_P3E_FEATURES}

${LV_P3E_MODES}

## Caractéristiques techniques
### Batterie
Type de batterie | Lithium ou plomb-acide
Tension nominale batterie | 48 V
Tension de charge maximale | ≤ 60 V (configurable)
Courant de charge/décharge maximal | 250 A
### Entrée PV
Puissance DC maximale | 24000 W
Tension DC maximale | 1000 V
Plage de tension MPPT | 200 V à 800 V
Tension de démarrage | 150 V
Courant d’entrée maximal | 36 / 18 A
Nombre de MPPT | 2
### Sortie AC (raccordé au réseau)
Puissance apparente maximale | 13200 W
Tension nominale | 380/400 V
Fréquence nominale | 50/60 Hz
Courant de sortie max. | 20 A
Facteur de puissance | 1 (0,8 capacitif à 0,8 inductif)
### Sortie AC (hors réseau)
Puissance apparente nominale | 12000 W
Puissance apparente maximale | > 200 % pendant 15 s
Tension nominale | 380/400 V
Fréquence nominale | 50/60 Hz
Courant de sortie max. | 20 A
### Rendement
Rendement MPPT | 98 %
Rendement maximal | 94,5 %
Rendement européen | 97,5 %
${LV_P3E_PROTECTIONS}
### Données générales
Mise en parallèle | Jusqu’à 8 unités
${LV_P3E_ENVIRONMENT}
Poids | 38 kg
Dimensions (L × H × P) | 475 × 683 × 256 mm
${LV_P3E_STANDARDS}

${NOTE}`,
  },
  {
    slug: 'aurora-yf-lv-p3e-20048',
    name: 'Onduleur hybride triphasé Aurora YF-LV-P3E-20048 (20 kW, 48 V)',
    price: 0,
    category: 'onduleurs',
    images: ['/products/aurora-yf-lv-p3e-20048.webp'],
    description: `Onduleur hybride triphasé Aurora Power de 20 kW pour batterie basse tension 48 V (lithium ou plomb-acide), sortie 380/400 V.
Jusqu’à 40 kW de panneaux sur 2 MPPT, 20 kW en sortie raccordée au réseau comme en autonomie, mise en parallèle jusqu’à 8 unités et boîtier IP66.

## Points forts
- Courant d’entrée PV : 4 × 20 A
${LV_P3E_FEATURES}

## Gamme
Modèle de la série d’onduleurs hybrides triphasés 48 V de 15 à 24 kW : YF-LV-P3E-15048, YF-LV-P3E-18048, YF-LV-P3E-20048 et YF-LV-P3E-24048.

${LV_P3E_MODES}

## Caractéristiques techniques
### Batterie
Type de batterie | Lithium ou plomb-acide
Tension nominale batterie | 48 V
Tension de charge maximale | ≤ 60 V (configurable)
Courant de charge/décharge maximal | 450 A
### Entrée PV
Puissance DC maximale | 40000 W
Tension DC maximale | 1000 V
Plage de tension MPPT | 150 V à 900 V
Tension de démarrage | 180 V
Courant d’entrée maximal | 4 × 20 A
Nombre de MPPT | 2
### Sortie AC (raccordé au réseau)
Puissance apparente maximale | 20000 W
Tension nominale | 380/400 V
Fréquence nominale | 50/60 Hz
Courant de sortie max. | 58 / 29 A
Facteur de puissance | 1 (0,8 capacitif à 0,8 inductif)
### Sortie AC (hors réseau)
Puissance apparente nominale | 20000 W
Puissance apparente maximale | > 200 % pendant 15 s
Tension nominale | 380/400 V
Fréquence nominale | 50/60 Hz
Courant de sortie max. | 29 A
### Rendement
Rendement MPPT | 99,9 %
Rendement maximal | 98 %
Rendement européen | 97,2 %
${LV_P3E_PROTECTIONS}
### Données générales
Mise en parallèle | Jusqu’à 8 unités
${LV_P3E_ENVIRONMENT}
Poids | 40 kg
Dimensions (L × H × P) | 448 × 660 × 265 mm
${LV_P3E_STANDARDS}

${NOTE}`,
  },
  {
    slug: 'aurora-hv-stacking-60kw',
    name: 'Système haute tension Aurora : batterie empilable + onduleur triphasé 60 kW',
    price: 0,
    category: 'solar-kits',
    images: ['/products/aurora-hv-stacking-60kw.webp'],
    description: `Système de stockage haute tension Aurora Power : batterie lithium empilable associée à un onduleur triphasé de 60 kW.
De 81,9 kWh à 175,5 kWh selon le nombre de modules empilés, pour les sites professionnels et les grandes installations. Disponible dès maintenant.

## Onduleur triphasé
- Puissance : 60 kW
- Plage de tension : 135 V à 850 V
- Indice de protection IP66

## Batterie haute tension empilable
- Modules de batterie empilables en armoire, sur deux colonnes
- Boîtier de contrôle haute tension avec écran LCD
- Capacité modulable selon le nombre de modules

## Caractéristiques techniques
### Onduleur
Type | Onduleur triphasé
Puissance | 60 kW
Plage de tension | 135 V à 850 V
Indice de protection | IP66
### Configurations de la batterie (tension → énergie)
358,4 V | 81,9 kWh
460,8 V | 105,98 kWh
614,4 V | 140,4 kWh
768 V | 175,5 kWh

## Remarques
Informations issues du visuel commercial Aurora Power. Fiche technique détaillée et dimensionnement sur demande.
Caractéristiques susceptibles d’être modifiées sans préavis.`,
  },
];
