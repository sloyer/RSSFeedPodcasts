export interface FeedSource {
  id: string;
  name: string;
  apiCode: string; // API source code for the clean URL API
  logo?: string;
  enabled: boolean;
  priority?: number; // 1 = high priority (load first), 2 = medium, 3 = low
}

const feeds: FeedSource[] = [
  // Priority feeds - most reliable and fast loading (enabled by default)
  {
    id: "vitalmx",
    name: "Vital MX",
    apiCode: "VITALMX",
    enabled: false,
    priority: 1,
  },
  {
    id: "racerx",
    name: "Racer X",
    apiCode: "RACERX",
    enabled: true,
    priority: 1,
  },
  {
    id: "mxa",
    name: "Motocross Action",
    apiCode: "MXA",
    enabled: false,
    priority: 1,
  },
  {
    id: "mxvice",
    name: "MX Vice",
    apiCode: "MXVICE",
    enabled: false,
    priority: 1,
  },
  {
    id: "swapmoto",
    name: "Swap Moto Live",
    apiCode: "SWAPMOTO",
    enabled: true,
    priority: 1,
  },
  
  // Secondary feeds - high quality sources
  {
    id: "pulpmx",
    name: "PulpMX",
    apiCode: "PULPMX",
    enabled: false,
    priority: 2,
  },
  {
    id: "transworldmx",
    name: "Transworld MX",
    apiCode: "TRANSWORLDMX",
    enabled: false,
    priority: 2,
  },
  {
    id: "cyclenews",
    name: "Cycle News",
    apiCode: "CYCLENEWS",
    enabled: false,
    priority: 2,
  },
  {
    id: "dirtbikemagazine",
    name: "Dirt Bike Magazine",
    apiCode: "DIRTBIKEMAGAZINE",
    enabled: false,
    priority: 2,
  },
  {
    id: "dirtbiketest",
    name: "Dirt Bike Test",
    apiCode: "DIRTBIKETEST",
    enabled: false,
    priority: 2,
  },
  {
    id: "mxlarge",
    name: "MX Large",
    apiCode: "MXLARGE",
    enabled: false,
    priority: 2,
  },
  {
    id: "motoxaddicts",
    name: "MotoXAddicts",
    apiCode: "MOTOXADDICTS",
    enabled: false,
    priority: 2,
  },
  {
    id: "motoxpod",
    name: "MotoXPod",
    apiCode: "MOTOXPOD",
    enabled: false,
    priority: 2,
  },
  {
    id: "motocrossplanet",
    name: "Motocross Planet",
    apiCode: "MOTOCROSSPLANET",
    enabled: false,
    priority: 2,
  },
  {
    id: "mxperformance",
    name: "Motocross Performance Magazine",
    apiCode: "MOTOCROSSPERFORMANCEMAGAZINE",
    enabled: false,
    priority: 2,
  },
  {
    id: "motoonline",
    name: "MotoOnline",
    apiCode: "MOTOONLINE",
    enabled: false,
    priority: 2,
  },
  {
    id: "gatedrop",
    name: "GateDrop",
    apiCode: "GATEDROP",
    enabled: false,
    priority: 2,
  },
  {
    id: "dirthub",
    name: "DirtHub",
    apiCode: "DIRTHUB",
    enabled: false,
    priority: 2,
  },
  {
    id: "supercross",
    name: "Supercross Official",
    apiCode: "SUPERCROSS",
    enabled: false,
    priority: 2,
  },
  {
    id: "smx",
    name: "SMX Official",
    apiCode: "SMX",
    enabled: true,
    priority: 2,
  },
  {
    id: "wsx",
    name: "World Supercross Championship",
    apiCode: "WSX",
    enabled: false,
    priority: 2,
  },
  {
    id: "aussx",
    name: "Australian Supercross Official",
    apiCode: "AUSSX",
    enabled: false,
    priority: 2,
  },
  {
    id: "directmx",
    name: "Direct Motocross",
    apiCode: "DIRECTMX",
    enabled: false,
    priority: 2,
  },
  {
    id: "keefer",
    name: "Keefer Inc Testing",
    apiCode: "KEEFER",
    enabled: false,
    priority: 2,
  },
];

export default feeds;