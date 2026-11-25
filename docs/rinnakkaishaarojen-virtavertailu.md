# Rinnakkaishaarojen virranjako

Ratkaisija laskee haaravirrat annetusta kokonaisvirrasta, avoimen piirin jännitteistä, polarisaatiotiloista ja haaravastuksista. Kunkin haaran lähdejännite on Eⱼ = OCVⱼ − vₚₒₗ,ⱼ ja johtavuus Gⱼ = 1/Rⱼ. Yhteisen solmun jännite on V = (ΣGⱼEⱼ − I)/ΣGⱼ ja Iⱼ = Gⱼ(Eⱼ − V). Positiivinen virta purkaa. Ratkaisija käyttää annettuja haaratiloja yhden hetken piiriratkaisussa.

Testeissä samanlaiset kennot jakavat lataus- ja purkuvirran tasan. Epäsymmetrisen parin virrat summautuvat kokonaisvirraksi ja antavat saman napajännitteen molemmissa haaroissa. Eri lähdejännitteillä pari voi vaihtaa virtaa myös kokonaisvirran ollessa nolla.

Ratkaisu on Kirchhoffin virtalain yhden solmun erikoistapaus. liionpack ratkaisee yleisen kytkentäverkon modifioidulla solmuanalyysilla ja voi kuvata erilliset virtakiskovälit sekä kennokohtaiset PyBaMM-tilat. Piombon mittauskytkentä on 4P-tikapuu. Tässä kokeessa vastuserot esitetään tehollisina haaravastuksina. [Tranter ym. 2022](https://doi.org/10.21105/joss.04051) · [liionpackin ratkaisin](https://liionpack.readthedocs.io/en/latest/reference/) · [Piombo ym. 2024](https://doi.org/10.1016/j.est.2024.110783)

## Kalibrointi ja riippumattomat vaiheet

Käytettiin Piombon aineiston version 1 tiedostoa `M1_NMC_Unaged_R3_T25.mat`. Kalibrointi käyttää neljää aineiston valmiiksi kalibroitua Hall-virtakanavaa ensimmäisen CC-latauksen 300–600 sekunnin ikkunassa. Oletetaan yhteinen lähdejännite ja sovitetaan johtavuuksien suhteet mitattujen haaravirtojen osuuksiin. Suhteet lukitaan ennen pisteytystä. Absoluuttista vastustasoa ja lähdejännitettä tarvitaan napajännitteen tunnistamiseen. Tässä niille annetut skaala 0,01 Ω ja 3,8 V häviävät virranjakoyhtälöstä.

Pisteytetään erillisen CC-latauksen ja CC-purun näytteet 300 sekunnista vaiheiden loppuun. Virrat lasketaan mitatusta moduulivirrasta. Lisäksi ajetaan sama koe kahdella tehollisella haaralla yhdistämällä Hall-kanavat 1+2 ja 3+4. Osasummat kuvaavat saman 4P-kokeen virtoja. Fyysisen 2P-parin mittaus tarvitaan 2P-ennusteen validointiin. [Piombon aineisto v1](https://doi.org/10.17632/zh58byr53c.1) · [Mittaus- ja Hall-kalibrointimenetelmä](https://pmc.ncbi.nlm.nih.gov/articles/PMC10907183/)

| Vaihe | Näytteet | Haarat | Tasajaon RMSE | Vakioisten vastusten RMSE |
| --- | ---: | --- | ---: | ---: |
| CC-lataus | 8 057 | 4P | 0,1163 A | 0,2694 A |
| CC-purku | 3 925 | 4P | 0,6367 A | 0,9412 A |
| CC-lataus | 8 057 | 2 osasummaa | 0,2034 A | 0,5013 A |
| CC-purku | 3 925 | 2 osasummaa | 1,1947 A | 1,7481 A |

Kalibrointi antoi neljälle haaralle osuudet 32,05 %, 26,72 %, 20,72 % ja 20,50 %. Vakio-osuudet ylisovittivat kalibrointi-ikkunan suhteessa kumpaankin erilliseen vaiheeseen. Purussa moduulimittauksen ja mitattujen haaravirtojen summan ero oli 1,5491 A RMS ja latauksessa 0,1259 A RMS. Tämä asettaa virran säilyttävälle 4P-mallille jo noin 0,3873 A:n ja 0,0315 A:n RMSE-alarajat. Eron syytä ei selvitetty. Muuttuvien kennotilojen ja tikapuun erillisten välivastusten vaikutus on tässä aineistossa vielä arvioimatta.

Ratkaisija on simulaatiomoduuli ja mittausvertailu kutsuu sitä suoraan. Sovellus käyttää tasajakoa. HSC:n 13S2P-integraatio edellyttää haarakohtaista kapasiteetti-, OCV-, pulssi- ja liitinvastusdataa sekä vertailua samanaikaisesti mitattuihin 2P-haaravirtoihin. HSC:n epäsymmetrinen virranjako jää kalibroimattomaksi.

## Toisto

Lataa aineistoversion 1 ZIP. Valitun MATLAB-tiedoston SHA-256 on `85076072c6057d11e3ddb793b5ae47d8d0065d3148fbd208de968f65a4a6cb1b`. Lukija käyttää SciPyn version 1.17.0 MAT-lukijaa version 1 MATLAB-taulukkoon tallennettujen nimettyjen virtasarakkeiden purkuun. [Aineisto v1](https://data.mendeley.com/datasets/zh58byr53c/1)

```sh
python -m pip install scipy==1.17.0
python scripts/read_piombo_currents.py /polku/aineisto.zip | node scripts/compare_parallel_current.mjs
npm test
npm run build
```

Käytä Node 24:ää TypeScript-moduulin suorittamiseen.
