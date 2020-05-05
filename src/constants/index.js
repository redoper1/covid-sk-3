const regions = [
    'Bratislavský',
    'Trnavský',
    'Trenčínský',
    'Nitranský',
    'Žilinský',
    'Banskobystrický',
    'Prešovský',
    'Košický',
    '?'
];

const regionsByCounty = {
    'Bratislavský': [
        'Bratislava',
        'Bratislava I',
        'Bratislava II',
        'Bratislava III',
        'Bratislava IV',
        'Bratislava V',
        'Malacky',
        'Pezinok',
        'Senec'
    ],
    'Trnavský': [
        'Dunajská Streda',
        'Galanta',
        'Hlohovec',
        'Piešťany',
        'Senica',
        'Skalica',
        'Trnava'
    ],
    'Trenčínský': [
        'Bánovce nad Bebravou',
        'Ilava',
        'Myjava',
        'Nové Mesto nad Váhom',
        'Partizánske',
        'Považská Bystrica',
        'Prievidza',
        'Púchov',
        'Trenčín'
    ],
    'Nitranský': [
        'Komárno',
        'Levice',
        'Nitra',
        'Nové Zámky',
        'Šaľa',
        'Topoľčany',
        'Zlaté Moravce'
    ],
    'Žilinský': [
        'Bytča',
        'Čadca',
        'Dolný Kubín',
        'Kysucké Nové Mesto',
        'Liptovský Mikuláš',
        'Martin',
        'Námestovo',
        'Ružomberok',
        'Turčianske Teplice',
        'Tvrdošín',
        'Žilina'
    ],
    'Banskobystrický': [
        'Banská Bystrica',
        'Banská Štiavnica',
        'Brezno',
        'Detva',
        'Krupina',
        'Lučenec',
        'Poltár',
        'Revúca',
        'Rimavská Sobota',
        'Veľký Krtíš',
        'Zvolen',
        'Žarnovica',
        'Žiar nad Hronom'
    ],
    'Prešovský': [
        'Bardejov',
        'Humenné',
        'Kežmarok',
        'Levoča',
        'Medzilaborce',
        'Poprad',
        'Prešov',
        'Sabinov',
        'Snina',
        'Stará Ľubovňa',
        'Stropkov',
        'Svidník',
        'Vranov nad Topľou'
    ],
    'Košický': [
        'Gelnica',
        'Košice',
        'Košice I',
        'Košice II',
        'Košice III',
        'Košice IV',
        'Košice–okolí',
        'Košice–okolie',
        'Košice - okolie',
        'Michalovce',
        'Rožňava',
        'Sobrance',
        'Spišská Nová Ves',
        'Trebišov'
    ],
    '?': [
        '?',
        'neuvedený'
    ]
}

const LATEST = "LATEST";

module.exports = {
    regions,
    regionsByCounty,
    LATEST
}