// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.10;

import "./openzeppelin-contracts/token/ERC721/ERC721.sol";
import "./openzeppelin-contracts/token/ERC721/extensions/ERC721URIStorage.sol";


    //Registrar: cifrar el archivo antes de subirlo a IPFS
    //subir archivos -> hash
    //antes de resgitarar -> terminos & condiciones
    //en vez de almacenar directamente los motivos disputas -> hash 
    //ver las licencias que tienen los usuarios  - propietario
    

    //funcion - resolver disputa -> mediador o propietario
    //revocar licencia temporal  & renovar

    //añadir modificadores
    //aleta de expiracion -> licencias temporales 
    //eliminar archivo (IPFS)

contract OraculoVerificacionAcceso {
    mapping(uint256 => mapping (address => bool)) private accesoUsuarios;

    function actualizarAcceso(address usuario, uint256 tokenId, bool acceso) external {
        accesoUsuarios[tokenId][usuario] = acceso;
    }

    function validarAcceso(address usuario, uint256 tokenId) external view returns (bool) {
        return accesoUsuarios[tokenId][usuario];
    }
}


// Oráculo para validación de acceso
interface IOracle {
    function actualizarAcceso(uint256 tokenId, address usuario, bool acceso) external;
    function validarAcceso(address usuario, uint256 tokenId) external view returns (bool);
}


contract PropiedadIntelectual is ERC721URIStorage {
    struct Archivo {
        string titulo;
        string descripcion;
        string hash;
        uint256 tiempo;
        uint256 tokenId;
    }

    struct Transferencia { 
        //address antiguoPropietario;
        //address nuevoPropietario;
        bytes32 hashTransferencia;
        uint256 fecha;
    }

    struct Disputa {
        //address denunciante;
        bytes32 hashDisputa;
        string motivo;
        uint256 fecha;
    }
   
    struct Licencia {
        //address usuario;
        bytes32 hashLicencia;
        bool esTemporal;
        uint256 tiempoExpiracion; // 0 para licencias permanentes
    }   

    struct Claim {
        address usuario;
        uint256 tokenId;
        uint256 fecha;
        uint256 duracion; // 0 para claims permanentes, valor positivo para temporales
        bool acceso;
    }

    uint256 private _tokenIdCounter;
    address[] public propietarios;
    mapping(address => bool) public direccionesRegistradas;
    mapping(address => Archivo[]) private _archivos;
    mapping(uint256 => Transferencia[]) private _historialTransferencias;
    mapping(uint256 => Disputa[]) private _historialDisputas;

    // Mapeo para guardar el consentimiento explícito de los usuarios
    mapping(address => bool) private _consentimientoDado;

    // Mappings para claims
    mapping(uint256 => mapping(address => Claim)) private claims;

    // Mapeo para guardar claves
    mapping(uint256 => bytes32) private clavesCifrado; 
    mapping(uint256 => uint256) private nonces;      

    // Dirección del oráculo
    address private oracleAddress;


    event ConsentimientoAceptado(address usuario);
    event RegistroRealizado(address indexed propietario, string hash_ipfs, string titulo, uint256 fecha, uint256 tokenId);
    event TransferenciaPropiedad(bytes32 hashTransferencia, uint256 fecha);
    event DisputaRegistrada(bytes32 hashDisputa, string motivo, uint256 fecha);

    // Eventos para claims
    event ClaimEmitido(address indexed usuario, uint256 tokenId, uint256 duracion);
    event ClaimRevocado(address indexed usuario, uint256 tokenId);
    event ClaimRenovado(address indexed usuario, uint256 tokenId, uint256 nuevaDuracion);

    /* ===== Modificador propietario ===== */
    modifier soloPropietario(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "No eres el propietario del token");
        _;
    }

    constructor(address _oracleAddress) ERC721("PropiedadIntelectualNFT", "PI_NFT") {
        oracleAddress = _oracleAddress;
    }

     /* ===== Consentimiento Explícito ===== */
    function aceptarTerminosYCondiciones() external {
        require(!_consentimientoDado[msg.sender], "Ya aceptaste los terminos y condiciones");
        _consentimientoDado[msg.sender] = true;
        emit ConsentimientoAceptado(msg.sender);
    }

    function verificarConsentimiento(address usuario) external view returns (bool) {
        return _consentimientoDado[usuario];
    }
    
    /* ===== Derecho al Olvido ===== */
    function eliminarArchivo(uint256 tokenId) external soloPropietario(tokenId){
        //require(ownerOf(tokenId) == msg.sender, "Solo el propietario puede eliminar este archivo");
        // Eliminar el archivo del mapeo del propietario
        Archivo[] storage archivos = _archivos[msg.sender];
        for (uint256 i = 0; i < archivos.length; i++) {
            if (archivos[i].tokenId == tokenId) {
                archivos[i] = archivos[archivos.length - 1];
                archivos.pop();
                break;
            }
        }

        _burn(tokenId); // Eliminar el NFT asociado
    }

    /* Funciones relacionadas con los verifiable claims */
    ////////////// EMITIR CLAIMS
    function emisionClaims(address usuario, uint256 tokenId, uint256 duracionClaim) public soloPropietario (tokenId) {
        claims[tokenId][usuario] = Claim({
            usuario: usuario,
            tokenId: tokenId,
            fecha: block.timestamp,
            duracion: duracionClaim == 0 ? 0 : block.timestamp + duracionClaim,
            acceso: true
        });

        emit ClaimEmitido(usuario, tokenId, duracionClaim);
    }

    ////////////// REVOCAR CLAIMS
    function revocacionClaims(address usuario, uint256 tokenId) public soloPropietario (tokenId){
        Claim storage claim = claims[tokenId][usuario];
        require(claim.acceso == true, "El claim no esta activo.");

         // Revocar acceso en el oráculo
        IOracle oracle = IOracle(oracleAddress);
        oracle.actualizarAcceso(tokenId, usuario, false);
        
        incrementarNonce(tokenId);
        claim.acceso = false;

        // Re-emitir claims a todos los usuarios que deberían mantener acceso
        for (uint256 i = 0; i < propietarios.length; i++) {
            address user = propietarios[i];
            Claim storage newClaim = claims[tokenId][usuario];

            // Si el claim estaba activo, generamos un nuevo claim
            if (newClaim.acceso == false) {
                // Crear nuevo claim con acceso renovado
                emisionClaims(user, tokenId, newClaim.duracion);
            }
        }

        emit ClaimRevocado(usuario, tokenId);
    }

    ////////////// VERIFICAR CLAIMS 
    function verificacionClaims(address usuario, uint256 tokenId) public view returns (bool){
        Claim storage claim = claims[tokenId][usuario];

        if (!claim.acceso || (claim.duracion > 0 && block.timestamp > claim.duracion)) {
            return false;
        }

         // Validar acceso con el oráculo
        IOracle oracle = IOracle(oracleAddress);
        return oracle.validarAcceso(usuario, tokenId);
    }

    /////////////// RENOVAR CLAIMS
    function renovarClaim(address usuario, uint256 tokenId, uint256 nuevaDuracion) public soloPropietario(tokenId){
        Claim storage claim = claims[tokenId][usuario];
        require(claim.acceso == true, "El claim no esta activo.");

        claim.duracion = block.timestamp + nuevaDuracion;
        emit ClaimRenovado(usuario, tokenId, nuevaDuracion);
    }

    /* ===== Registro de Propiedad ===== */
    function registro(string calldata hash_ipfs, string calldata titulo, string calldata descripcion, bytes32 claveCifrado) external {
        require(_consentimientoDado[msg.sender], "Debes aceptar los terminos y condiciones antes de registrar");
        require(bytes(hash_ipfs).length > 0, "Hash invalido");
        require(bytes(titulo).length > 0, "Titulo invalido");
        require(bytes(descripcion).length > 0, "Descripcion invalida");

        uint256 tokenId = ++_tokenIdCounter; 
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", hash_ipfs)));

        _archivos[msg.sender].push(Archivo(titulo, descripcion, hash_ipfs, block.timestamp, tokenId));

        if (!direccionesRegistradas[msg.sender]) {
            direccionesRegistradas[msg.sender] = true;
            propietarios.push(msg.sender);
        }

        // Almacenar la clave de cifrado para este archivo
        clavesCifrado[tokenId] = claveCifrado;

        // Iniciar el nonce para este archivo (cada archivo tiene un nonce único)
        nonces[tokenId] = 0;

        emisionClaims(msg.sender, tokenId, 0);
        emit RegistroRealizado(msg.sender, hash_ipfs, titulo, block.timestamp, tokenId);
    }

    function concederAcceso(uint256 tokenId) external view returns (bytes32) {
        return obtenerClaveConNonce(tokenId, msg.sender);
    }

    function comprobarAcceso(uint256 tokenId, address usuario) external view returns (bool) {
        return verificacionClaims(usuario, tokenId);
    }

    function verifyProperty(uint256 tokenId, address usuario) public view returns (bool) {
        return ownerOf(tokenId) == usuario;
    }

    function verifyMyProperty(uint256 tokenId) public view returns (bool){
        return ownerOf(tokenId) == msg.sender;    
    }

    function darLicenciaTemporal(uint256 tokenId, address usuario, uint256 duracionLicencia) external soloPropietario(tokenId) {
        emisionClaims(usuario, tokenId, duracionLicencia);
    }

    function listarClaimsArchivo (uint256 tokenId) public view soloPropietario(tokenId) returns(Claim[] memory) {
        uint claimsTotales = 0;
        for (uint256 i=0; i<propietarios.length;i++){
            address usuario = propietarios[i];
            if (claims[tokenId][usuario].acceso) {
                claimsTotales++;
            }
        }

        Claim[] memory listaClaims = new Claim[](claimsTotales);
        uint256 index = 0;

        for (uint256 i = 0; i < propietarios.length; i++) {
            address usuario = propietarios[i];
            Claim storage claim = claims[tokenId][usuario];
            if (claim.acceso) {
                listaClaims[index] = claim;
                index++;
            }
        }

        return listaClaims;
    }

    /* ===== Transferencia de Propiedad ===== */
    
    function transferProperty(address nuevoPropietario, uint256 tokenId) external soloPropietario(tokenId) {
        require(nuevoPropietario != address(0), "Direccion invalida");
        // Obtener la dirección del propietario actual
        address antiguoPropietario = msg.sender;
        require(nuevoPropietario != antiguoPropietario, "El nuevo propietario no puede ser el mismo que el antiguo");

        // Crear el hash identificador de la transferencia
        bytes32 identificadorHash = keccak256(
            abi.encodePacked(antiguoPropietario, nuevoPropietario, tokenId, block.timestamp)
        );
        
        // Verificar que la transferencia no haya sido registrada previamente
        require(!verificarTransferencia(tokenId, antiguoPropietario, nuevoPropietario, block.timestamp), "La transferencia ya fue registrada");


        // Almacenar la transferencia en el historial
        _historialTransferencias[tokenId].push(Transferencia(identificadorHash, block.timestamp));
        safeTransferFrom(antiguoPropietario, nuevoPropietario, tokenId);

        if (!direccionesRegistradas[nuevoPropietario]) {
            direccionesRegistradas[nuevoPropietario] = true;
            propietarios.push(nuevoPropietario);
        }

        emit TransferenciaPropiedad(identificadorHash, block.timestamp);
    }

    function transferHistory(uint256 tokenId) external view returns (Transferencia[] memory) {
        require(_historialTransferencias[tokenId].length > 0, "No hay transferencias registradas para este token");
        return _historialTransferencias[tokenId];
    }

    function verificarTransferencia(uint256 tokenId, address antiguoPropietario, address nuevoPropietario, uint256 fecha) internal view returns (bool) {
        bytes32 hashPropuesto = keccak256(abi.encodePacked(antiguoPropietario, nuevoPropietario, tokenId, fecha));

        // Verificar si el hash coincide con alguno en el historial
        Transferencia[] storage transferencias = _historialTransferencias[tokenId];
        for (uint256 i = 0; i < transferencias.length; i++) {
            if (transferencias[i].hashTransferencia == hashPropuesto) {
                return true; // La transferencia ya está registrada
            }
        }
        return false; // No se ha encontrado la transferencia
    }




    /* ===== Auditoría y Certificación ===== */
    function registryCertificate(address propietario, string calldata hashActual)
        external
        view
        returns (string memory titulo, string memory descripcion, string memory hash, uint256 tiempo)
    {
        Archivo[] storage archivosPropietario = _archivos[propietario];
        for (uint256 i = 0; i < archivosPropietario.length; i++) {
            Archivo storage archivo = archivosPropietario[i];
            if (keccak256(abi.encodePacked(archivo.hash)) == keccak256(abi.encodePacked(hashActual))) {
                return (archivo.titulo, archivo.descripcion, archivo.hash, archivo.tiempo);
            }
        }
        revert("Archivo no encontrado");
    }

    function fileAudit(uint256 tokenId, string calldata hashActual) external view soloPropietario(tokenId) returns (bool) {
        // Obtener el propietario del token para verificar si el llamante es el propietario
        address propietario = ownerOf(tokenId);
        Archivo[] storage archivosPropietario = _archivos[propietario];

        // Iterar a través de los archivos del propietario para verificar el hash
        for (uint256 i = 0; i < archivosPropietario.length; i++) {
            if (keccak256(abi.encodePacked(archivosPropietario[i].hash)) == keccak256(abi.encodePacked(hashActual))) {
                return true;
            }
        }
        return false;
    }

    /* ===== Gestión de Disputas ===== */
    function registrarDisputa(uint256 tokenId, string calldata motivoDenuncia) external {
        address propietario = ownerOf(tokenId);
        require(propietario != address(0), "Token sin propietario");

        // Crear un hash para la disputa
        bytes32 hashDisputa = keccak256(abi.encodePacked(msg.sender, motivoDenuncia, block.timestamp));

        // Registrar la disputa con el hash
        _historialDisputas[tokenId].push(Disputa(hashDisputa,motivoDenuncia,block.timestamp));
        emit DisputaRegistrada(hashDisputa,motivoDenuncia,block.timestamp);
    }

    function verDisputas(uint256 tokenId) external view returns (Disputa[] memory) {
        return _historialDisputas[tokenId];
    }

    /* ===== Listado de Archivos ===== */
    function listarArchivos(address propietario) external view returns (Archivo[] memory) {
        return _archivos[propietario];
    }

    function listarTodosArchivos() external view returns (Archivo[] memory) {
        uint256 totalArchivos;
        for (uint256 i = 0; i < propietarios.length; i++) {
            totalArchivos += _archivos[propietarios[i]].length;
        }

        Archivo[] memory allArchives = new Archivo[](totalArchivos);
        uint256 index;
        for (uint256 i = 0; i < propietarios.length; i++) {
            Archivo[] storage archivosProp = _archivos[propietarios[i]];
            for (uint256 j = 0; j < archivosProp.length; j++) {
                allArchives[index++] = archivosProp[j];
            }
        }
        return allArchives;
    }

    /* ===== Incrementar Nonce (al revocar acceso) ===== */
    function incrementarNonce(uint256 tokenId) private {
        nonces[tokenId]++;
    }

    /* ===== Obtener Clave Derivada con Nonce ===== */
    function obtenerClaveConNonce(uint256 tokenId, address usuario) public view returns (bytes32) {
        require(verificacionClaims(usuario, tokenId), "No tienes acceso");
        return keccak256(abi.encodePacked(clavesCifrado[tokenId], nonces[tokenId]));
    }


}