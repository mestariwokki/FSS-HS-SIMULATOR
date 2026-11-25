# Pussikennon yhden ja kahden lämpösolmun vertailu

Zenodon aineisto kuvaa lämpöeristetyn, mekaanisesti kuormitetun 75 Ah:n NMC/grafiittipussikennon kuvattua pintaa. Kaksi aluetta ovat y-koordinaatin ylin viidennes ja muu kuvattu pinta. Aluejako lukitaan ennen sovitusta. Jokaiselle alueelle käytetään kaikkina ajanhetkinä kelvollisten pikselien keskiarvoa. Reuna-alue toimii tilallisen lämpömallin vertailukohteena. Liuskan lämpötilaa tai erillisen anturin vastetta ei ole aineistossa. [Zenodo 17938718](https://zenodo.org/records/17938718)

Yhden solmun lämpötila muuttuu yhtälön dT/dt = a(I/75 A)² − k(T−Tₐ) mukaan. Kahdessa solmussa kummallakin alueella on oma lämmityskerroin. Solmujen välinen johtuminen siirtää lämpöä niin, että pinta-alapainotettu keskiarvo säilyy. Malli olettaa lämpökapasiteetin verrannolliseksi kuvattuun pinta-alaan ja saman ympäristöön jäähtymisen aikavakion kummallekin alueelle. Alkukuvan aluekeskiarvot alustavat kaksi solmua, ja koko pinnan alkukeskiarvo toimii ympäristön lämpötilana. Virta pidetään näytteiden välillä vakiona ja tila ratkaistaan eksponentiaalisesti.

Sovitetaan 1C- ja 2C-purkuihin, minkä jälkeen parametrit lukitaan ja ajetaan 3C-purku.

| 3C-purku | Mitattu | 1 solmu | 2 solmua |
| --- | ---: | ---: | ---: |
| Rungon RMSE | | 2,367 °C | 2,767 °C |
| Reunan RMSE | | 2,512 °C | 1,812 °C |
| Rungon huippu | 48,228 °C | 48,704 °C | 49,027 °C |
| Reunan huippu | 47,882 °C | 48,704 °C | 48,807 °C |
| Aluehuippujen ajankohta | 1 393,3 s | 1 393,3 s | 1 393,3 s |

Kuumin mitattu pikseli saavutti 50,707 °C kohdassa 1 333,6 s, noin 60 s ennen aluekeskiarvojen huippuja. Ajankohtaero havainnollistaa tilallisen keskiarvoistuksen vaikutusta. Anturiviiveen tunnistaminen vaatii samasta kohdasta sekä nopean vertailumittauksen että arvioitavan anturin aikasarjan.

Toinen solmu paransi reunan aikasarjaa, mutta heikensi rungon aikasarjaa ja molempien alueiden huippuarvojen tarkkuutta. Jäähtymiskerroin osui molemmissa malleissa alarajalle ja reunasolmun oma lämmitys osui kahden solmun mallissa alarajalle. Valittu kuormitus ja eristys jättävät kertoimet heikosti tunnistetuiksi. Yhden solmun malli jää HSC-sovelluksen oletukseksi. Kennoliuskan huippulämpö, sen ajankohta ja anturiviive jäävät HSC:lle kalibroimattomiksi.

PyBaMMin lumped-malli käyttää yhtä tilalämpötilaa ja yhdistää ympäristöön jäähtymisen sekä ohmisen, reaktioiden ja palautuvan lämmön. Tämän vertailun I²-lähde on pelkistys, koska aineisto ei erota näitä lämpölähteitä. [PyBaMMin lämpömallit](https://docs.pybamm.org/en/stable/source/examples/notebooks/models/thermal-models.html)

## Toisto

Lataa tiedosto `surface_temperature_pouchcell_data_allC.h5` Zenodon tietueesta 17938718. Käytetyn tiedoston SHA-256 on `d4b2b8a53982ce6f211be0b89f5d62faceed4dc9c69ef6ca5038379cc0cd29a1`. [Mittausaineisto](https://zenodo.org/records/17938718)

```sh
python -m pip install h5py numpy scipy
python scripts/compare_pouch_thermal.py /polku/surface_temperature_pouchcell_data_allC.h5
npm test
npm run build
```
