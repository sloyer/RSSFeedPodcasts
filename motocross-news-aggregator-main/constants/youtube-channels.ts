export interface YouTubeChannel {
  id: string;
  name: string;
  description: string;
  apiCode: string; // API channel code for the clean URL API
  enabled: boolean;
}

const youtubeChannels: YouTubeChannel[] = [
  {
    id: "vitalmx",
    name: "Vital MX",
    description: "Latest motocross and supercross videos",
    apiCode: "vitalmx",
    enabled: false,
  },
  {
    id: "racerx",
    name: "Racer X",
    description: "Official Racer X YouTube channel",
    apiCode: "racerx",
    enabled: false,
  },
  {
    id: "promotocross",
    name: "Pro Motocross",
    description: "Official Pro Motocross Championship",
    apiCode: "promotocross",
    enabled: false,
  },
  {
    id: "supercross",
    name: "Monster Energy Supercross",
    description: "Official Monster Energy Supercross",
    apiCode: "supercross",
    enabled: true,
  },
  {
    id: "pulpmx",
    name: "PulpMX",
    description: "PulpMX Show and motocross content",
    apiCode: "pulpmx",
    enabled: false,
  },
  {
    id: "keefer",
    name: "Keefer Inc Testing",
    description: "Keefer Inc Testing motocross bikes",
    apiCode: "keefer",
    enabled: false,
  },
  {
    id: "swapmoto",
    name: "Swap Moto Live",
    description: "Swap Moto Live show",
    apiCode: "swapmoto",
    enabled: false,
  },
  {
    id: "mxvice",
    name: "MX Vice",
    description: "European motocross coverage",
    apiCode: "mxvice",
    enabled: true,
  },
  {
    id: "gypsytales",
    name: "Gypsy Tales",
    description: "Gypsy Tales motocross content",
    apiCode: "gypsytales",
    enabled: false,
  },
  {
    id: "dirtbike",
    name: "Dirt Bike Magazine",
    description: "Dirt Bike Magazine official channel",
    apiCode: "dirtbike",
    enabled: true,
  },
  {
    id: "motocrossaction",
    name: "Motocross Action",
    description: "Motocross Action Magazine",
    apiCode: "motocrossaction",
    enabled: false,
  },
  {
    id: "foxracing",
    name: "Fox Racing",
    description: "Fox Racing official channel",
    apiCode: "foxracing",
    enabled: false,
  },
  {
    id: "motoplayground",
    name: "Moto Playground",
    description: "Moto Playground content",
    apiCode: "motoplayground",
    enabled: false,
  },
  {
    id: "wsx",
    name: "World Supercross",
    description: "World Supercross Championship",
    apiCode: "wsx",
    enabled: false,
  },
  {
    id: "teamfried",
    name: "Team Fried",
    description: "Team Fried motocross content",
    apiCode: "teamfried",
    enabled: false,
  },
];

export default youtubeChannels;