# Avoimet akkumittaukset HSC v3:n simulaattorin arviointiin

Ensimmäiseksi kannattaa toistaa alla oleva LG M50 -kennon jäähtymiskoe. Siinä mallin syöte, mitattu vertailulämpötila ja alkuarvo ovat samassa tiedostossa. Jännitemallin seuraava vertailu kannattaa tehdä CALCE:n ajoaineistolla ja rinnakkaishaarojen virranjako Piombon työryhmän haaravirtamittauksilla. HSC:n omat kennot ovat EP9343126VVP-pussikennoja. Kirjaa jokaiselle ulkoiselle vertailulle oma kenno ja testikokoonpano ja määritä HSC:n lopulliset parametrit omista mittauksista. [Chen ym., mittausdata](https://zenodo.org/records/4032561) · [CALCE, avoimet mittaukset](https://calce.umd.edu/battery-data) · [Piombo ym., rinnakkaismoduulien mittaukset](https://data.mendeley.com/datasets/zh58byr53c/1) · [Oulun tiimin lähtötiedot](../codex-tasks/lv-battery-design-research.md)

## Aineiston valinta mallin osan mukaan

| Mallin osa | Avoin aineisto ja sen sisältö | Koe simulaattorille |
| --- | --- | --- |
| Akun lämpötila ja jäähtyminen | Kolmen LG M50 -kennon CSV-tiedostot sisältävät virran, jännitteen sekä kennon pinnan ja lämpökammion lämpötilan. Mukana on CC–CV-latauksia ja purkuja C/10–1,5C. [Data](https://zenodo.org/records/4032561) · [Chen ym., menetelmäjulkaisu](https://doi.org/10.1149/1945-7111/AB9050) | Käytä kammion lämpötilaa syötteenä ja pinnan lämpötilaa vertailusuureena. Sovita yhdellä kennolla ja jätä toinen kokonainen kenno riippumattomaan arviointiin. Yhden kennon lepojaksoilla tehty ensimmäinen koe on jäljempänä. |
| Lepojännite, varaustila ja dynaaminen jännitevaste | Marylandin yliopiston CALCE julkaisee hitaan ja portaittaisen OCV-mittauksen sekä DST-, FUDS-, US06- ja BJDST-kuormituksia. Tietokannassa on useita kennotyyppejä. [CALCE, Battery Data](https://calce.umd.edu/battery-data) | Valitse saman kennotyypin ja lämpötilan sarjat. Sovita OCV ja 1RC/2RC-mallit OCV-, pulssi- tai DST-mittauksiin. Lukitse parametrit ja aja FUDS tai US06 mitatulla virralla. Vertaa virhettä millivoltteina, pulssin pohjaa ja jännitteen palautumista. |
| Kennoparin virranjako | Piombo ym. mittasivat 54 koetilannetta, joissa vaihdeltiin lämpötilaa, liitosvastusta, kennokemiaa ja ikää. Aineistossa on moduulin jännite, kokonaisvirta, yksittäisten haarojen virrat ja pintalämpötilat. Saatavilla on raakadata Excel-muodossa ja käsitelty MATLAB-aineisto. [Mittausdata](https://data.mendeley.com/datasets/zh58byr53c/1) · [Avoin menetelmäjulkaisu](https://wrap.warwick.ac.uk/id/eprint/183745/1/1-s2.0-S2352340924001987-main.pdf) | Toista ensin lähteen todellinen kytkentä ja anturipaikat. Vertaa tasajaon ennustetta mitattuihin haaravirtoihin, vaihda yhden haaran liitosvastusta ja arvioi paraneeko haarakohtainen ennuste. Tarkista haarojen summa ja suurin yksittäinen virhe ampeereina. Siirrä menetelmä sen jälkeen Oulun 2P-pariin. |
| Pussikennon kuumin kohta | Eristetyn, esipuristetun 75 Ah:n NMC/grafiittipussikennon pintalämpötilakenttä 1C-, 2C- ja 3C-latauksessa ja -purussa. Tietueessa on HDF5-tiedosto sekä Python- ja MATLAB-lukijat. [Mittausdata ja lukijat](https://zenodo.org/records/17938718) | Vertaa kussakin ajanhetkessä pinnan keskiarvoa, maksimia ja virtaliuskan lähellä olevan alueen arvoa. Näin voi arvioida, milloin yhden lämpötilan malli tarvitsee erillisen liuskasolmun. Mittaa Oulun ilmajäähdytteisen pinon omat lämpövastukset ja NTC-viive erikseen. |
| Jäähdytys Formula Student -autossa | Dynamis PRC sovitti kriittisen kennon lämpömallia kestävyysajon mittauksiin. Työ antaa esimerkin siitä, miten akuston ilmavirtaus ja rata-ajo yhdistetään samaan arviointiin. [Politecnico di Milano, opinnäyte](https://www.politesi.polimi.it/handle/10589/186378) | Käytä Oulun suljetun HSC:n tuloilmaa, puhaltimen toimintatilaa, akkuvirtaa ja molempien pinojen liuskalämpötiloja. Arvioi kuumimman kohdan lämpötila ja ajankohta kokonaisella ajolla, joka jätettiin sovituksen ulkopuolelle. |

## Laskettu vertailu avoimesta lämpötilamittauksesta

Tarkastin tiedoston `LGM50_cell02.csv` (MD5 `0bbf959cbfc367296ec69d7a74d2f5c1`). Valitsin lepojakson 18 noin 5 A:n purun jälkeen sovitukseen ja lepojakson 23 noin 7,5 A:n purun jälkeen saman kennon sisäiseen vertailuun. Mallin oletus on, että kennon pintalämpötila lähestyy kammion mitattua lämpötilaa yhdellä aikavakiolla. Ohitin kummankin jakson ensimmäiset 300 s, jotta vertailu kohdistuu jäähtymisen hitaaseen osaan. Kummankin ennusteen alkuarvo on sen oman tarkasteluikkunan ensimmäinen pintalämpötila. Koe arvioi tätä pelkistettyä lämpömallia. Tulokset eivät ole HSC:n tai nykyisen sovelluksen mitattuja ennustevirheitä. [Alkuperäinen CSV ja metatiedot](https://zenodo.org/records/4032561)

| Jakso | Aikavakio | RMSE, °C | Suurin itseisvirhe, °C |
| --- | ---: | ---: | ---: |
| 18, sovitus, 300–7 200 s | 984 s | 0,100 | 0,186 |
| 23, vertailu, 300–7 200 s | sama | 4,064 | 13,555 |
| 23, jälkikäteen tarkasteltu osuus ennen mittauskanavan hyppyä, 300–6 016 s | sama | 0,140 | 0,389 |

Jakson 23 kohdalla 6 015–6 045 s pintalämpötilalukema muuttuu 26,9823 °C:sta 13,2729 °C:een ja kammiolukema 26,8127 °C:sta 26,7629 °C:een. Syytä ei voi päätellä näistä sarakkeista. Säilytä koko jakson tulos ja merkitse jälkikäteen valittu osuus erikseen. Käytännön seuraus simulaattorille on, että mitatun ympäristölämpötilan on voitava muuttua ajan mukana ja vertailun on säilytettävä anturikanavan poikkeamat näkyvissä. Lepokäyrästä saadaan lämpökapasiteetin ja lämmönsiirtokertoimen suhde `τ = C_th / UA`. Niiden määrittäminen erikseen vaatii lisätietoa lämpötehosta tai lämpökapasiteetista. [Mittausaineisto](https://zenodo.org/records/4032561) · [Simulaattorin lämpömallin muutos](https://github.com/mestariwokki/FSS-HS-SIMULATOR/pull/8)

### Laskun toistaminen

Lataa tietueesta `LGM50_cell02.csv`, tallenna alla oleva koodi tiedostoon `jaahdytys.py` ja aja `python3 jaahdytys.py LGM50_cell02.csv`. Koodi käyttää Pythonin standardikirjastoa ja oikeita aikaleimoja. Se etsii pienimmän näytekohtaisen neliöllisen keskivirheen kokonaislukuaikavakioista 30–3 600 s. Tulosteen parit ovat RMSE ja suurin itseisvirhe celsiusasteina. [Ladattava aineisto](https://zenodo.org/records/4032561)

```python
import csv, math, sys
with open(sys.argv[1], newline="") as file:
    for i in range(13):
        next(file)
    rows = list(csv.DictReader(file))

def run(step, tau, end=7200):
    data = [r for r in rows if int(r["Step"]) == step
            and 300 <= float(r["Step Time [s]"]) <= end]
    pred = float(data[0]["Temperature Cell [degC]"])
    errors = []
    for a, b in zip(data, data[1:]):
        dt = float(b["Test Time [s]"]) - float(a["Test Time [s]"])
        if dt <= 0:
            continue
        ambient = float(a["Temperature Chamber [degC]"])
        pred = ambient + (pred - ambient) * math.exp(-dt / tau)
        errors.append(pred - float(b["Temperature Cell [degC]"]))
    return (sum(e*e for e in errors) / len(errors))**0.5, max(map(abs, errors))

tau = min(range(30, 3601), key=lambda t: run(18, t)[0])
print(tau, run(18, tau), run(23, tau), run(23, tau, 6016))
```

## Mitä testataan seuraavaksi nykyisessä koodissa

1. **Tee mittausprofiilista toistettava syöte.** Säilytä aikaleimat ja käsittele virran suunta aineistokohtaisesti. Esimerkiksi Chenin CSV:ssä lataus- ja purkuvirrat ovat suuruuksia ja `Md` erottaa latauksen (`C`), purun (`D`) ja levon (`R`). Oulun mallin positiivinen virta tarkoittaa purkua. Testaa muunnos ennen varaustilan integrointia. [Mittausdata](https://zenodo.org/records/4032561) · [Virtaohjauksen lähdekoodi](https://github.com/mestariwokki/FSS-HS-SIMULATOR/blob/c0c6ca777b89973815773ce3928f66ad73630244/src/simulation/currentControl.ts)
2. **Tarkista lämpömalli kolmessa tilanteessa.** Käytä ensin nollavirtaa ja täysin relaksoitunutta kennoa, sitten lepoa heti kuormituspulssin jälkeen ja lopuksi kuormitusta, jonka aikana kammion lämpötila muuttuu. Lepojakson jälkilämpö voi sisältää useita ilmiöitä. Pelkkä lämpötilakäyrä ei yksilöi kummankin RC-haaran häviötehoa. Tallenna jänniterelaksaatio ja lämpötila samasta pulssista. [Chenin mittaukset](https://zenodo.org/records/4032561) · [Lämpömallin toteutus ja testit](https://github.com/mestariwokki/FSS-HS-SIMULATOR/pull/8)
3. **Mittaa lisämallin hyöty ennen käyttöönottoa.** Vertaa 1RC:tä ja 2RC:tä samalla syötteellä ja erillisellä ajosyklillä. Vertaa lämpöverkkoa yhden lämpötilan malliin kuumimman kohdan virheen perusteella. Vertaa haaramallia tasajakoon haaravirran huippuvirheellä. Tallenna aineistoversio, valmistelusäännöt, parametrit ja testiin kokonaan sivuun jätetyt ajot. [CALCE](https://calce.umd.edu/battery-data) · [Pussikennon lämpökartat](https://zenodo.org/records/17938718) · [Rinnakkaismoduulien data](https://data.mendeley.com/datasets/zh58byr53c/1)
4. **Siirrä validoitu menetelmä HSC:hen.** Kerää EP-kennoista omat OCV- ja pulssimittaukset, yhdestä parista molemmat haaravirrat sekä valmiista kotelosta tuloilma ja liuskalämpötilat. Vertaa samoja virhesuureita kuin julkisella datalla. Aseta tavoitetarkkuus suunnittelupäätöksen ja anturien epävarmuuden mukaan ennen sovitusta. [HSC:n projektikuvaus](../codex-tasks/lv-battery-design-research.md) · [Mallien verifiointi ja validointi, NASA-STD-7009](https://standards.nasa.gov/standard/nasa/nasa-std-7009)

Lähteet tarkistettu 25.11.2026. Numeerinen koe tehtiin Chenin työryhmän kennon 02 raakatiedostolla. Muista aineistoista taulukko kuvaa tutkimusryhmien julkaisemia mittauksia ja niille ehdotettuja vertailuja.
