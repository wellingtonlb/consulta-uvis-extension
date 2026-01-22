document.addEventListener('DOMContentLoaded', function() {
    console.log("Extensão iniciada.");

    let geoJsonData = null;
    let bairroCache = "";

    const nomeDoArquivo = 'Territórios_UVIS.geojson';

    fetch(chrome.runtime.getURL(nomeDoArquivo))
        .then(r => r.json())
        .then(data => {
            geoJsonData = data;
            console.log("Base de dados carregada!");
        })
        .catch(err => {
            console.error("Erro ao ler arquivo:", err);
            document.querySelector('h3').innerText = "❌ ERRO: Arquivo não encontrado";
            document.querySelector('h3').style.color = "red";
            alert(`ATENÇÃO: Não consegui ler o arquivo "${nomeDoArquivo}".\n\nVerifique se o nome na pasta está IDÊNTICO.`);
        });

    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('blur', function() {
            let cep = this.value.replace(/\D/g, '');
            if (cep.length === 8) {
                fetch(`https://viacep.com.br/ws/${cep}/json/`)
                    .then(res => res.json())
                    .then(data => {
                        if (!data.erro) {
                            document.getElementById('logradouro').value = data.logradouro;
                            bairroCache = data.bairro;
                        }
                    })
                    .catch(err => console.log("Erro no ViaCEP", err));
            }
        });
    }

    const btn = document.getElementById('btn-consultar');
    if (btn) {
        btn.addEventListener('click', function() {
            const rua = document.getElementById('logradouro').value;
            const num = document.getElementById('numero').value;
            const cepVal = document.getElementById('cep').value;

            if (!rua) return alert("Preencha o logradouro.");

            const loading = document.getElementById('loading');
            const results = document.getElementById('results-area');

            btn.style.display = 'none';
            loading.style.display = 'block';
            results.style.display = 'none';

            const query = `${rua}, ${num}, São Paulo, Brasil`;

            fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`, {
                headers: {
                    "Accept-Language": "pt-BR"
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro HTTP: ${response.status}`);
                }
                return response.text().then(text => {
                    try {
                        return JSON.parse(text);
                    } catch (err) {
                        throw new Error("A API retornou um erro de bloqueio ou formato inválido.");
                    }
                });
            })
            .then(data => {
                loading.style.display = 'none';
                btn.style.display = 'block';

                if (data && data.length > 0) {
                    document.getElementById('res-log').innerText = rua + (num ? `, ${num}` : '');
                    
                    let cepEncontrado = cepVal;
                    if (!cepEncontrado && data[0].address && data[0].address.postcode) {
                        cepEncontrado = data[0].address.postcode;
                    }

                    document.getElementById('res-cep').innerText = cepEncontrado || "Não informado";

                    let bairroMapa = "";
                    if (data[0].address) {
                        bairroMapa = data[0].address.suburb || data[0].address.neighbourhood || data[0].address.residential || data[0].address.city_district || "";
                    }
                    const bairroFinal = bairroCache || bairroMapa || "Não identificado";
                    document.getElementById('res-bairro').innerText = bairroFinal;

                    verificarLocal(parseFloat(data[0].lat), parseFloat(data[0].lon));
                    results.style.display = 'block';
                } else {
                    alert("Endereço não encontrado pelo mapa. Tente verificar a escrita.");
                }
            })
            .catch((err) => {
                loading.style.display = 'none';
                btn.style.display = 'block';
                console.error(err);
                alert("Erro de conexão: " + err.message);
            });
        });
    }

    function verificarLocal(lat, lon) {
        if (!geoJsonData) return document.getElementById('res-uvis').innerText = "Erro: Base de dados não carregou.";
        if (typeof turf === 'undefined') return alert("ERRO CRÍTICO: O arquivo turf.js não foi encontrado/carregado.");

        const ponto = turf.point([lon, lat]);
        let candidatosUVIS = [];
        let candidatosDA = [];

        turf.featureEach(geoJsonData, function(feat) {
            if (turf.booleanPointInPolygon(ponto, feat)) {
                const props = feat.properties;
                for (const [key, value] of Object.entries(props)) {
                    const k = key.toLowerCase();
                    const v = String(value).trim();

                    if (k.includes('uvis')) {
                        let pontos = 0;
                        if (k.includes('nome') || k.includes('nm') || k.includes('desc')) pontos += 20;
                        if (isNaN(v)) pontos += 10;
                        if (k.includes('cod') || k.includes('id')) pontos -= 10;
                        candidatosUVIS.push({
                            valor: v,
                            pontos: pontos
                        });
                    }
                    if (k.includes('da') || k.includes('distrito')) {
                        let pontos = 0;
                        if (k.includes('nome') || k.includes('nm') || k.includes('desc')) pontos += 20;
                        if (isNaN(v)) pontos += 10;
                        candidatosDA.push({
                            valor: v,
                            pontos: pontos
                        });
                    }
                }
            }
        });

        candidatosUVIS.sort((a, b) => b.pontos - a.pontos);
        candidatosDA.sort((a, b) => b.pontos - a.pontos);

        document.getElementById('res-uvis').innerText = candidatosUVIS.length > 0 ? candidatosUVIS[0].valor : "Fora da área mapeada";
        document.getElementById('res-da').innerText = candidatosDA.length > 0 ? candidatosDA[0].valor : "Fora da área mapeada";
    }

    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const el = document.getElementById(targetId);
            if (el) {
                const text = el.innerText;
                navigator.clipboard.writeText(text).then(() => {
                    const originalText = this.innerText;
                    this.innerText = "✓";
                    this.classList.add('copied');
                    setTimeout(() => {
                        this.innerText = originalText;
                        this.classList.remove('copied');
                    }, 1500);
                });
            }
        });
    });
});