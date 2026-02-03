document.addEventListener('DOMContentLoaded', function() {
    
 
    let geoJsonData = null;  
    let geoJsonUBS = null;   
 
    const arquivoUVIS = 'Territórios_UVIS.geojson'; 
    const arquivoUBS = 'Territorios_UBS.geojson';

    const btnConsultar = document.getElementById('btn-consultar');
    const btnLimpar = document.getElementById('btn-limpar');
    const loading = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    
 
    const cepInput = document.getElementById('cep');
    const logradouroInput = document.getElementById('logradouro');
    const numeroInput = document.getElementById('numero');

 
    const mainContent = document.getElementById('main-content');
    const selectionScreen = document.getElementById('selection-screen');
    const selectionList = document.getElementById('selection-list');
    const btnVoltar = document.getElementById('btn-voltar');

 
    let cidadeViaCEP = ""; 
    let bairroViaCEP = "";  

 
    Promise.all([
        fetch(chrome.runtime.getURL(arquivoUVIS)).then(r => r.json()),
        fetch(chrome.runtime.getURL(arquivoUBS)).then(r => r.json())
    ])
    .then(([dataUVIS, dataUBS]) => {
        geoJsonData = dataUVIS;
        geoJsonUBS = dataUBS;
        if (btnConsultar) {
            btnConsultar.innerText = "🔍︎​ CONSULTAR";
            btnConsultar.disabled = false;
        }
    })
    .catch(err => {
        console.error(err);
        mostrarErro("Erro ao carregar arquivos GeoJSON.");
    });

 

 
    [cepInput, logradouroInput, numeroInput].forEach(el => {
        if(el) {
            el.addEventListener('input', () => {
                resultsDiv.style.display = 'none';  
                mostrarErro("");  
                
                if (el === logradouroInput) cepInput.value = ""; 
                
 
                if (el === cepInput) {
                    let v = cepInput.value.replace(/\D/g, '');
                    if (v.length > 5) v = v.replace(/^(\d{5})(\d)/, '$1-$2');
                    cepInput.value = v;
                    if (v.replace(/\D/g, '').length === 8) preencherEnderecoPeloCEP(v.replace(/\D/g, ''));
                }
            });
        }
    });

    if(btnConsultar) btnConsultar.addEventListener('click', buscarEndereco);
    
    if(btnLimpar) {
        btnLimpar.addEventListener('click', function() {
            cepInput.value = "";
            logradouroInput.value = "";
            numeroInput.value = "";
            resultsDiv.style.display = 'none';
            mostrarErro("");
            cidadeViaCEP = "";
            bairroViaCEP = "";
        });
    }

    if(btnVoltar) {
        btnVoltar.addEventListener('click', function() {
            selectionScreen.style.display = 'none';
            mainContent.style.display = 'block';
        });
    }

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', function (e) { 
            if (e.key === 'Enter') buscarEndereco(); 
        });
    });

 

    function limparLogradouro(nome) {
        const termos = ["rua", "avenida", "av\\.", "av", "travessa", "tv\\.", "tv", "alameda", "al\\.", "al", "praça", "praca", "pç", "viela", "largo", "estrada", "rodovia", "doutor", "dr\\.", "dr", "dra\\.", "dra", "professor", "prof\\.", "prof", "profa\\.", "profa", "tenente", "ten\\.", "ten", "coronel", "cel\\.", "cel", "major", "maj\\.", "maj", "capitão", "capitao", "cap\\.", "cap", "general", "gen\\.", "gen", "almirante", "alm\\.", "alm", "brigadeiro", "brig\\.", "brig", "marechal", "mar\\.", "mar", "sargento", "sgt\\.", "sgt", "governador", "gov\\.", "gov", "presidente", "pres\\.", "pres", "deputado", "dep\\.", "dep", "senador", "sen\\.", "sen", "padre", "pe\\.", "pe", "bispo", "dom", "freira", "irmã", "irma", "engenheiro", "eng\\.", "eng", "arquiteto", "arq\\.", "arq"];
        const regex = new RegExp(`\\b(${termos.join("|")})\\b`, "gi");
        return nome.replace(regex, "").replace(/\s+/g, " ").trim();
    }

    function obterCidade(addr) { 
        return addr.city || addr.town || addr.municipality || addr.village || addr.county || "São Paulo"; 
    }

    function validarResultadoGeografico(item, cidadeEsperada) {
        const lat = parseFloat(item.lat);
        if (cidadeEsperada === "" || cidadeEsperada === "São Paulo") {
            if (lat < -24.05) return false; 
        }
        return true;
    }

    async function preencherEnderecoPeloCEP(cep) {
        try {
            logradouroInput.placeholder = "Carregando...";
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/?_=${new Date().getTime()}`);
            const data = await response.json();

            if (!data.erro) {
                logradouroInput.value = data.logradouro;
                cidadeViaCEP = data.localidade;
                bairroViaCEP = data.bairro;
                if(numeroInput) numeroInput.focus();
            } else {
                logradouroInput.placeholder = "CEP não encontrado";
            }
        } catch (error) {
            console.error(error);
            logradouroInput.placeholder = "Erro na busca";
        }
    }

 

    async function buscarEndereco() {
        if (!geoJsonData) return mostrarErro("Aguarde bases...");

 
        resultsDiv.style.display = 'none';
        
        let cep = cepInput.value.replace(/\D/g, '');
        let logradouro = logradouroInput.value.trim();
        let numero = numeroInput.value.trim();

        if (logradouro === "") return mostrarErro("Digite o logradouro.");

        loading.style.display = 'block';

 
        if (cep.length === 8 && cidadeViaCEP === "") {
            await preencherEnderecoPeloCEP(cep);
            logradouro = logradouroInput.value;
        }

        const urlBase = "https://nominatim.openstreetmap.org/search?";
        const commonParams = "&format=json&limit=15&addressdetails=1&email=wellingtonlb22@outlook.com";

        const processarResultados = (data) => {
 
            let validos = data.filter(item => validarResultadoGeografico(item, cidadeViaCEP));
            if (validos.length === 0) return false;

 
            if (bairroViaCEP !== "") {
                const validosNoBairro = validos.filter(item => {
                    const addr = item.address || {};
                    const texto = (JSON.stringify(addr) + item.display_name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
                    const bairroBusca = bairroViaCEP.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "");
                    return texto.includes(bairroBusca);
                });
                if (validosNoBairro.length > 0) validos = validosNoBairro;
            }

 
            if (numero !== "") {
                const comNumero = validos.filter(item => item.address && item.address.house_number === numero);
                if (comNumero.length > 0) {
                    processarItemFinal(comNumero[0]);
                    return true;
                }
            }

 
            const unicos = [];
            const seen = new Set();
            validos.forEach(item => {
                const addr = item.address || {};
                const bairro = addr.suburb || addr.neighbourhood || addr.city_district || "";
                const cidade = obterCidade(addr);
                const chave = (item.display_name.split(',')[0] + bairro + cidade).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '');
                if (!seen.has(chave)) { seen.add(chave); unicos.push(item); }
            });

            if (unicos.length === 1) processarItemFinal(unicos[0]);
            else mostrarListaSelecao(unicos);
            
            return true;
        };

 
        if (cidadeViaCEP !== "") {
            const paramsStruct = new URLSearchParams({
                street: numero !== "" ? `${numero} ${logradouro}` : logradouro,
                city: cidadeViaCEP,
                country: 'Brazil'
            });
            if(cep.length === 8) paramsStruct.append('postalcode', cep);

            fetch(urlBase + paramsStruct.toString() + commonParams)
                .then(r => r.json())
                .then(data => {
                    if (data.length > 0 && processarResultados(data)) return;
                    else fazerBuscaFlexivel(logradouro, true); 
                })
                .catch(() => fazerBuscaFlexivel(logradouro, true));
        } else {
            fazerBuscaFlexivel(logradouro, true);
        }

        function fazerBuscaFlexivel(nomeRua, permitirSanitizacao) {
            let q = `${nomeRua}`;
            if (numero !== "") q += `, ${numero}`;
            const cidadeAlvo = cidadeViaCEP || "São Paulo";
            q += `, ${cidadeAlvo}, Brazil`;

            const p = new URLSearchParams({ q: q });
            if (cidadeAlvo === "São Paulo") { p.set('viewbox', '-47.20,-23.10,-46.10,-24.00'); p.set('bounded', '1'); }

            fetch(urlBase + p.toString() + commonParams)
                .then(r => r.json())
                .then(data => {
                    if (data.length > 0) { if (processarResultados(data)) return; }
                    
                    if (permitirSanitizacao) {
                        const nomeLimpo = limparLogradouro(logradouro);
                        if (nomeLimpo !== logradouro && nomeLimpo.length > 3) {
                            fazerBuscaFlexivel(nomeLimpo, false);
                        } else { 
                            loading.style.display = 'none'; mostrarErro("Endereço não localizado (tente sem número)."); 
                        }
                    } else { 
                        loading.style.display = 'none'; mostrarErro("Endereço não localizado."); 
                    }
                })
                .catch(() => { loading.style.display = 'none'; mostrarErro("Erro de conexão."); });
        }
    }

 
    function mostrarListaSelecao(itens) {
        loading.style.display = 'none';
        mainContent.style.display = 'none';  
        selectionScreen.style.display = 'block';  
        selectionList.innerHTML = "";

        itens.forEach(item => {
            const addr = item.address || {};
            const rua = addr.road || addr.street || item.display_name.split(',')[0];
            const bairro = addr.suburb || addr.neighbourhood || addr.city_district || "Bairro não informado";
            const cidade = obterCidade(addr);
            const num = addr.house_number ? `Nº ${addr.house_number}` : "";

            const div = document.createElement('div');
            div.className = 'selection-item';
            div.innerHTML = `
                <div class="sel-rua">${rua} ${num}</div>
                <div class="sel-detalhe"><span class="badge-bairro">${bairro}</span> - ${cidade}</div>
            `;
            div.onclick = () => {
                selectionScreen.style.display = 'none';
                mainContent.style.display = 'block';
                
 
                cidadeViaCEP = cidade; 
                bairroViaCEP = bairro;
                if(!cepInput.value && addr.postcode) cepInput.value = addr.postcode;

                processarItemFinal(item);
            };
            selectionList.appendChild(div);
        });
    }

 
    function processarItemFinal(item) {
        try {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            const addr = item.address || {};

 
            const ruaShow = addr.road || addr.street || item.display_name.split(',')[0];
            const numShow = addr.house_number || numeroInput.value || "";
            setText('res-log', ruaShow + (numShow ? `, ${numShow}` : ""));
            setText('res-bairro', addr.suburb || addr.neighbourhood || "-");
            setText('res-cidade', obterCidade(addr));
            
 
            let cepShow = addr.postcode || cepInput.value || "-";
            setText('res-cep', cepShow);

 
            if (typeof turf === 'undefined') throw new Error("Turf.js não carregado.");
            const ponto = turf.point([lon, lat]);
            
            let uvisEncontrada = "Fora da área mapeada";
            let daEncontrada = "-";
            let ubsEncontrada = "Não identificada";
            let achouUBS = false;

 
            turf.featureEach(geoJsonData, function (feat) {
                if (turf.booleanPointInPolygon(ponto, feat)) {
                    const props = feat.properties;
                    for (const [key, val] of Object.entries(props)) {
                        const k = key.toLowerCase();
                        if (k.includes('uvis') && !k.includes('endereco') && !k.includes('logradouro')) {
                             if (k.includes('nome') || k.includes('nm')) uvisEncontrada = val;
                             else if (uvisEncontrada === "Fora da área mapeada" && isNaN(val)) uvisEncontrada = val;
                        }
                        if ((k.includes('da') || k.includes('distrito')) && isNaN(val)) daEncontrada = val;
                    }
                }
            });

 
            if (geoJsonUBS) {
                turf.featureEach(geoJsonUBS, function (feat) {
                    if (achouUBS) return; 
                    if (turf.booleanPointInPolygon(ponto, feat)) {
                        const p = feat.properties;
                        for (const [key, val] of Object.entries(p)) {
                            if (key.match(/nome|name|fantasia/i)) {
                                ubsEncontrada = val;
                                achouUBS = true;
                                break;
                            }
                        }
                        if (!achouUBS && (p.description)) { ubsEncontrada = p.description; achouUBS = true; }
                    }
                });
            }

            setText('res-uvis', uvisEncontrada);
            setText('res-da', daEncontrada);
            
            const ubsEl = document.getElementById('res-ubs');
            if (achouUBS) {
                ubsEl.style.color = "#198754";
                ubsEl.innerText = ubsEncontrada;
            } else {
                ubsEl.style.color = "#6c757d";
                ubsEl.innerText = (uvisEncontrada !== "Fora da área mapeada") ? "Endereço na área, mas sem UBS vinculada" : "Fora da área de cobertura";
                if (uvisEncontrada !== "Fora da área mapeada") ubsEl.style.color = "#ffc107";
            }

            loading.style.display = 'none';
            resultsDiv.style.display = 'block';

        } catch (e) {
            console.error(e);
            mostrarErro("Erro: " + e.message);
        }
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if(el) el.innerText = text;
    }

    function mostrarErro(msg) {
        loading.style.display = msg ? 'block' : 'none';
        loading.style.color = 'red';
        loading.innerText = msg;
    }

 
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const el = document.getElementById(targetId);
            if(el) {
                navigator.clipboard.writeText(el.innerText).then(() => {
                    const original = this.innerText;
                    this.innerText = "✓";
                    setTimeout(() => { this.innerText = original; }, 1500);
                });
            }
        });
    });
});