export interface TooltipDef {
  abbr: string;
  name: string;
  description: string;
  formula?: string;
  unit: string;
  range: string;
}

const T: Record<string, TooltipDef> = {
  // ── Battery ──────────────────────────────────────────────────────────────
  V_batt: {
    abbr: 'V_batt',
    name: 'Akkupaketin kokonaisjännite',
    description: 'Lasketaan kertomalla yksittäisen kennon jännite sarjaan kytkettyjen kennojen määrällä. Laskee purku-aikana kun virta kasvaa.',
    formula: 'V_batt = V_kenno × S',
    unit: 'V',
    range: '35–58 V (13S LiCoO₂)',
  },
  V_oc: {
    abbr: 'V_oc',
    name: 'Tyhjäkäyntijännite (Open Circuit Voltage)',
    description: 'Akkupaketin jännite kun virtaa ei kulje. Riippuu SOC:sta ja kennokemiasta — kertoo akun todellisen energiatilan puhtaimmin.',
    formula: 'Määräytyy OCV–SOC -käyrästä',
    unit: 'V',
    range: '36–57 V (13S, SOC 0–100 %)',
  },
  SOC: {
    abbr: 'SOC',
    name: 'State of Charge — varauksen tila',
    description: 'Kertoo kuinka monta prosenttia akun kapasiteetista on jäljellä. 100 % = täynnä, 0 % = tyhjä. Lasketaan integroimalla virta ajan yli.',
    formula: 'SOC = SOC₀ − ∫I dt / Q_nom',
    unit: '%',
    range: '0–100 %',
  },
  I_batt: {
    abbr: 'I_batt',
    name: 'Akkuvirta',
    description: 'Positiivinen = purku (moottori ottaa virtaa), negatiivinen = lataus (regen-jarrutus palauttaa energiaa). Suuri virta lämmittää akkua.',
    unit: 'A',
    range: '−50–250 A (tyypillisesti)',
  },
  P_loss: {
    abbr: 'P_loss',
    name: 'Häviöteho',
    description: 'Akun sisäinen resistanssi muuttaa osan energiasta lämmöksi. Kasvaa virran neliön mukaan — kaksinkertaistamalla virta nelinkertaistuu häviö.',
    formula: 'P_loss = I² × R_int',
    unit: 'W',
    range: '0–1 000 W',
  },
  T_batt: {
    abbr: 'T_batt',
    name: 'Akkupaketin lämpötila',
    description: 'Nousee häviötehon takia. Liian korkea lämpö lyhentää akkupaketin ikää ja voi aiheuttaa turvallisuusriskin.',
    formula: 'dT/dt = P_loss / (m×Cp) − jäähdytys',
    unit: '°C',
    range: '20–60 °C (turvallinen käyttöalue)',
  },
  eta: {
    abbr: 'η (eta)',
    name: 'Hyötysuhde',
    description: 'Kertoo kuinka suuri osa syötetystä energiasta muuttuu hyödylliseksi työksi. Loput häviävät lämpönä moottoriin, ESC:iin ja johtimiin.',
    formula: 'η = P_mech / P_bat',
    unit: '',
    range: '0.70–0.95',
  },
  SoH_cap: {
    abbr: 'SoH_cap',
    name: 'State of Health — kapasiteetti',
    description: 'Kertoo kuinka suuri osuus akun alkuperäisestä kapasiteetista on jäljellä ikääntymisen jälkeen. 100 % = uusi, 80 % = tyypillinen elinikäraja.',
    formula: 'SoH_cap = 1 − kQ × syklit',
    unit: '%',
    range: '80–100 % (käytössä)',
  },
  SoH_res: {
    abbr: 'SoH_res',
    name: 'State of Health — sisäresistanssi',
    description: 'Kuvaa kuinka paljon akun sisäinen resistanssi on kasvanut ikääntymisen myötä. Kasvava resistanssi heikentää tehokykyä ja lisää lämpöhäviöitä.',
    formula: 'SoH_res = 1 + kR × syklit',
    unit: '',
    range: '1.00–1.50',
  },

  // ── Motor / ESC ──────────────────────────────────────────────────────────
  kV: {
    abbr: 'kV',
    name: 'Moottorivakio (kierrosnopeus/voltti)',
    description: 'Kertoo kuinka monta kierrosta per minuutti moottori pyörii per voltti tyhjäkäynnillä. Pieni kV = suuri vääntö, suuri kV = nopeus.',
    formula: 'Kt = 60 / (2π × kV)',
    unit: 'RPM/V',
    range: '50–500 RPM/V (FSO-sovellukset)',
  },
  Kt: {
    abbr: 'Kt',
    name: 'Vääntövakio (torque constant)',
    description: 'Kertoo kuinka paljon vääntöä syntyy ampeeeria kohden. Sähköisen ja mekaanisen puolen linkki: isompi Kt → enemmän vääntöä samalla virralla.',
    formula: 'Kt = 60 / (2π × kV) = 9.549 / kV',
    unit: 'Nm/A',
    range: '0.02–0.3 Nm/A',
  },
  P_cont: {
    abbr: 'P_cont',
    name: 'Jatkuva teho',
    description: 'Suurin teho jonka moottori tai akku voi antaa pitkäaikaisesti ylikuumenematta. Huipputeho on sallittu vain lyhyissä purskeissa (tyypillisesti ≤ 5 s).',
    unit: 'kW',
    range: '2–10 kW (BLDC, FSO)',
  },
  P_peak: {
    abbr: 'P_peak',
    name: 'Huipputeho',
    description: 'Lyhytaikainen maksimiteho jota moottori voi antaa ilman välitöntä vauriota. Rajoittuu virranrajoittimeen: kun 5 s huippuvirtaa käytetty, palataan jatkuvaan tehoon.',
    unit: 'kW',
    range: '4–20 kW (BLDC, FSO)',
  },
  I_cont: {
    abbr: 'I_cont',
    name: 'Jatkuva virta',
    description: 'Suurin virta jonka moottori kestää jatkuvasti. Ylitettäessä moottori alkaa kuumentua liikaa. Simulaattori rajoittaa virtaa tähän arvoon huippupursken jälkeen.',
    unit: 'A',
    range: '60–150 A (FSO BLDC)',
  },
  I_peak: {
    abbr: 'I_peak',
    name: 'Huippuvirta',
    description: 'Lyhytaikaisesti sallittu maksimivirta. Boost-ajastin seuraa aikaa — kun huippuvirtaa on käytetty 5 s, I_limit putoaa I_cont-tasolle.',
    unit: 'A',
    range: '80–200 A (FSO BLDC)',
  },
  eta_ESC: {
    abbr: 'η_ESC',
    name: 'ESC:n hyötysuhde',
    description: 'Osuus akkuenergiasta joka menee moottorille. Loput häviävät ESC:n transistoreissa ja johtimissa lämpönä.',
    unit: '',
    range: '0.92–0.98',
  },
  eta_motor: {
    abbr: 'η_motor',
    name: 'Moottorin hyötysuhde',
    description: 'Osuus sähkötehosta joka muuttuu mekaaniseksi tehoksi. Käämihäviöt (I²R) ja rautahäviöt syövät osan.',
    unit: '',
    range: '0.85–0.95',
  },
  eta_regen: {
    abbr: 'η_regen',
    name: 'Regeneratiivinen hyötysuhde',
    description: 'Osuus jarrutusenergiastä joka palautetaan akkuun. Loppu häviää lämpönä ESC:ssä ja moottorin käämissä.',
    unit: '',
    range: '0.75–0.90',
  },

  // ── ICE ──────────────────────────────────────────────────────────────────
  rpm: {
    abbr: 'RPM',
    name: 'Kierrosluku (Revolutions Per Minute)',
    description: 'Moottorin akselin pyörintänopeus. Vaikuttaa sekä vääntömomenttiin (ei-lineaarisesti, kurvin mukaan) että tehoon.',
    formula: 'P = T × ω = T × RPM × 2π/60',
    unit: 'RPM',
    range: '500–11 000 RPM (MT-07)',
  },
  bsfc: {
    abbr: 'BSFC',
    name: 'Ominaiskulutus (Brake Specific Fuel Consumption)',
    description: 'Kuinka monta grammaa polttoainetta moottori kuluttaa tuottaakseen yhden kilowattitunnin energiaa. Pienempi = tehokkaampi.',
    formula: 'BSFC = ṁ_fuel / P_shaft',
    unit: 'g/kWh',
    range: '230–400 g/kWh (bensiinimoottorit)',
  },
  ice_torque: {
    abbr: 'T_ice',
    name: 'ICE-vääntömomentti',
    description: 'Moottorin tuottama pyörittävä voima tietyllä kierrosluvulla. Luetaan kierrosluku-vääntö-kurvista interpoloimalla.',
    unit: 'Nm',
    range: '50–68 Nm (MT-07 690cc)',
  },

  // ── Vehicle ───────────────────────────────────────────────────────────────
  CdA: {
    abbr: 'CdA',
    name: 'Aerodynaaminen vastuspinta-ala',
    description: 'Vastuskerroin Cd kerrottuna ajoneuvon etupinta-alalla A. Kuvaa ilmanvastuksen suuruutta — pienempi = vähemmän ilmanvastusta.',
    formula: 'F_drag = ½ × ρ_air × CdA × v²',
    unit: 'm²',
    range: '0.25–0.60 m² (Formula Student)',
  },
  Crr: {
    abbr: 'Crr',
    name: 'Vierintävastuskerroin',
    description: 'Kuvaa renkaiden vierintävastusta. Pienempi arvo tarkoittaa vähemmän energiahäviötä. Riippuu renkaasta, paineesta ja ajoalustasta.',
    formula: 'F_roll = Crr × m × g',
    unit: '',
    range: '0.010–0.025 (asfalttirata)',
  },
  mu: {
    abbr: 'μ (mu)',
    name: 'Kitkakerrokerroin',
    description: 'Renkaan ja alustan välinen kitkakerroin. Rajoittaa kiihtyvyyden aikana käytettävissä olevan voiman — luistorajan määrittämiseen.',
    unit: '',
    range: '1.2–2.0 (slick-rengas, kuiva rata)',
  },
  gear_ratio: {
    abbr: 'i_gear',
    name: 'Välityssuhde',
    description: 'Moottorin akselin ja pyörän akselin välinen pyörimisnopeusten suhde. Suuri välitys = enemmän vääntöä pyörällä, pienempi nopeus.',
    formula: 'T_wheel = T_motor × i_gear × η_mech',
    unit: ':1',
    range: '2–8:1 (Formula Student)',
  },

  // ── SPM / electrochemistry ────────────────────────────────────────────────
  V_RC: {
    abbr: 'V_RC',
    name: 'RC-elementin jännitehäviö (2RC Thevenin)',
    description: 'Akkumallin RC-elementin jännite joka kuvaa diffuusiosta johtuvaa hidasta jännitteen laskua. Palautuu hitaasti kun virta loppuu.',
    formula: 'V_RC(t+dt) = V_RC(t)·e^(−dt/τ) + I·R·(1−e^(−dt/τ))',
    unit: 'V',
    range: '0–2 V (lyhytaikaiset piikit)',
  },
  eta_pos: {
    abbr: 'η_pos',
    name: 'Positiivin elektrodin ylijännite (Butler-Volmer)',
    description: 'Sähkökemiallinen ylijännite joka kuvaa kuinka paljon kennojännite poikkeaa tasapainotilanteesta virran vaikutuksesta. Kuormittaa akkua.',
    unit: 'V',
    range: '0–0.1 V',
  },
  xp: {
    abbr: 'x_p',
    name: 'Litiumpitoisuus — positiivielektrodi',
    description: 'Litiumi-ionien suhteellinen pitoisuus positiivelektrodin hilarakenteessa. 1 = täynnä, 0 = tyhjä. Ohjaa avoimen piirin jännitettä.',
    unit: '',
    range: '0.45–0.97 (LiCoO₂)',
  },
};

export default T;
