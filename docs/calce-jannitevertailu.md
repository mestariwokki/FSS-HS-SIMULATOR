# CALCE-jännitevertailu 25 °C:ssa

Sovitus käyttää Samsung INR18650-20R -kennon SP20-3 kahdeksaa 1 A:n purkupulssia (720 s) ja niiden lepoja. Lepojen viimeisistä jännitteistä muodostetaan paloittain lineaarinen OCV purkautuneiden ampeerituntien funktiona. Kummallakin mallilla on sama OCV sekä samat sovitusnäytteet. Pulssit säilytetään kokonaisina. Lepojen 60 ensimmäisen näytteen jälkeen sovitus käyttää joka 30. näytettä ja viimeistä näytettä.

Napajännite on U(ΔAh) − I R₀ − Σvⱼ ja haaran muutos on vⱼ(t+Δt) = vⱼ(t)e^(−Δt/τⱼ) + IRⱼ(1−e^(−Δt/τⱼ)). Positiivinen I purkaa. Käytämme näytteen virtaa edeltävän välin pitovirtana, ja OCV:n argumentti tulee mittalaitteen Ah-laskureista. Resistanssit rajattiin välille 0–0,5 Ω ja aikavakiot 0,2–2 000 s.

Parametrit lukitaan ennen SP20-2-kennon 80 % US06 -tiedoston lukua. Malli alustetaan täydellä varauksella viimeisen latauksen jälkeisen levon lopussa ja ajetaan myös testin varaustilan valmistelun läpi. Pisteytys kattaa ensimmäisen kokonaisen 600 s toiston ja sen päättävän nollavirtanäytteen (596 näytettä). Jännite-RMSE painottaa näytteitä yhtä paljon. Nettoenergia sisältää purun ja latauksen, ja mitattu vertailuarvo integroidaan samalla menetelmällä.

| Suure | Mitattu | 1RC | 2RC |
| --- | ---: | ---: | ---: |
| Sovitus-RMSE | | 7,251 mV | 7,057 mV |
| Sovituksen suurin virhe | | 25,988 mV | 22,712 mV |
| Ensimmäisen sovituspulssin kuoppa | 253,517 mV | 264,428 mV | 266,145 mV |
| Palautuma viimeisestä kuormanäytteestä noin 61 s levon jälkeen | 119,550 mV | 123,772 mV | 125,118 mV |
| US06 RMSE | | 37,005 mV | 43,156 mV |
| US06 suurin virhe | | 134,512 mV | 139,628 mV |
| US06 nettoenergia | 0,351396 Wh | 0,345591 Wh | 0,344893 Wh |

Vertailun oletusmalliksi jää 1RC. 2RC:n hidas aikavakio osui 2 000 sekunnin sovitusrajaan. Kun kokeessa rajattiin nopea haara enintään 20 sekuntiin ja hidas vähintään 20 sekuntiin, nopea haara osui jälleen rajaan ja US06 RMSE oli 36,014 mV. Tuloksen herkkyys rajoille ja pitkä 1 A:n pulssi osoittavat, että haarojen erottelu edellyttää useampia virta- ja aikaskaaloja. SP20-3:n OCV:n käyttäminen SP20-2:lle lisää kennokohtaista epävarmuutta.

## Vaikutus HSC v3 -malliin

Nykyinen `simStep` vähentää samasta napajännitteestä sekä 2RC-haarat että Butler–Volmer-ylijännitteet. Virrasta riippuvat pintapitoisuudet muuttavat lisäksi elektrodien potentiaaleja. Jos RC- ja ohminen vastus sovitetaan koko pulssivasteeseen kuten tässä kokeessa, sovitus sisältää myös sähkökemiallisen vasteen osuuden. Näiden parametrien siirtäminen nykyiseen hybridimalliin laskisi osan häviöistä kahdesti. Nykyisten HSC-parametrien päällekkäisyyden suuruus vaatii alkuperäiset sovitusmittaukset. Vertailu säilyttää sovelluksen nykyisen toiminnan. HSC:n EP9343126VVP-kennon ja 13S2P-akuston ennusteet jäävät kalibroimattomiksi.

PyBaMMin Thévenin-malli käyttää vastaavaa OCV-, ohmista vastus- ja RC-rakennetta. Sen sähkökemiallisissa malleissa puolestaan diffusion ja kinetiikan jännitehäviöt seuraavat elektrodien tiloista. [PyBaMM Thévenin](https://docs.pybamm.org/en/stable/source/api/models/equivalent_circuit/thevenin.html) · [PyBaMM SPM](https://docs.pybamm.org/en/stable/source/examples/notebooks/models/SPM.html)

## Toisto

Lataa alla olevat arkistot samaan hakemistoon. Ohjelma tulostaa niiden SHA-256-tarkisteet, parametrit ja mittarit. Käytetyt tarkisteet alkavat `4c658862790e` ja `cedf99281bad`. [SP20-3 OCV](https://web.calce.umd.edu/batteries/data/SP3_25C_IC_OCV_12_2_2015.zip) · [SP20-2 US06](https://web.calce.umd.edu/batteries/data/SP2_25C_US06.zip) · [CALCE:n koemenetelmät ja lähdeviitteet](https://calce.umd.edu/battery-data)

```sh
python -m pip install numpy pandas scipy openpyxl xlrd
python scripts/compare_calce_voltage.py /polku/aineistoihin
npm test
npm run build
```
