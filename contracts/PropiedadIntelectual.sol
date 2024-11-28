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



contract PropiedadIntelectual is ERC721URIStorage {
    struct Archivo {
        string titulo;
        string descripcion;
        string hash;
        uint256 tiempo;
        uint256 tokenId;
    }

    struct Transferencia { //quitar direcciones & usar hash
        address antiguoPropietario;
        address nuevoPropietario;
        uint256 fecha;
      //  string hash;
    }

    struct Disputa {
        address denunciante;
        string motivo;
        uint256 fecha;
        //string hash;
    }
   
    struct LicenciaTemporal {
        address usuario;
        uint256 tiempoExpiracion;
    }

    uint256 private _tokenIdCounter;
    address[] public propietarios;
    mapping(address => bool) public direccionesRegistradas;
    mapping(address => Archivo[]) private _archivos;
    mapping(uint256 => Transferencia[]) private _historialTransferencias;
    mapping(uint256 => Disputa[]) private _historialDisputas;

    mapping(uint256 => mapping(address => bool)) private _accessList;
    mapping(uint256 => mapping(address => uint256)) private _licenciasTemporales;

    // Mapeo para guardar el consentimiento explícito de los usuarios
    mapping(address => bool) private _consentimientoDado;

    event ConsentimientoAceptado(address usuario);
    event RegistroRealizado(address indexed propietario, string hash_ipfs, string titulo, uint256 fecha, uint256 tokenId);
    event TransferenciaPropiedad(address indexed antiguoPropietario, address indexed nuevoPropietario, uint256 tokenId, uint256 fecha);
    event DisputaRegistrada(address indexed reportante, address indexed propietario, uint256 tokenId, string motivo, uint256 fecha);


    /* ===== Modificador propietario ===== */
    modifier soloPropietario(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "No eres el propietario del token");
        _;
    }

    constructor() ERC721("PropiedadIntelectualNFT", "PI_NFT") {}

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



    /* ===== Registro de Propiedad ===== */
    function registro(string calldata hash_ipfs, string calldata titulo, string calldata descripcion) external {
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

        emit RegistroRealizado(msg.sender, hash_ipfs, titulo, block.timestamp, tokenId);
    }

    /* ===== Control de Acceso ===== */
    function accesoNFT(uint256 tokenId, address usuario) external soloPropietario(tokenId){
       // require(ownerOf(tokenId) == msg.sender, "Solo el propietario puede otorgar acceso");
        _accessList[tokenId][usuario] = true;
    }

    function comprobarAcceso(uint256 tokenId, address usuario) external view returns (bool) {
        return ownerOf(tokenId) == usuario || _accessList[tokenId][usuario];
    }

    function verifyProperty(uint256 tokenId, address usuario) public view returns (bool) {
        return ownerOf(tokenId) == usuario;
    }

    function verifyMyProperty(uint256 tokenId) public view returns (bool){
        return ownerOf(tokenId) == msg.sender;    
    }

    /* ===== Revocar acceso & licencia Temporal ===== */
    function revocarAcceso(uint256 tokenId, address usuario) external soloPropietario(tokenId) {
        //require(ownerOf(tokenId) == msg.sender, "Solo el propietario puede revocar el acceso");
        // Verificar si tiene acceso temporal activo
        if (_licenciasTemporales[tokenId][usuario] > block.timestamp) {
            _licenciasTemporales[tokenId][usuario] = 0; // Invalida la licencia temporal
        }
        _accessList[tokenId][usuario] = false;     
    }

    /* ===== Licencias Temporales ===== */
    function darLicenciaTemporal(uint256 tokenId, address usuario, uint256 duracionLicencia) external soloPropietario(tokenId) {
        //require(ownerOf(tokenId) == msg.sender, "Solo el propietario puede dar acceso limitado");
        _licenciasTemporales[tokenId][usuario] = block.timestamp + duracionLicencia;
        _accessList[tokenId][usuario] = true;
    }

    function verificarLicenciaTemporal(uint256 tokenId, address usuario) external returns (bool) {
        bool tieneAcceso = _accessList[tokenId][usuario];
        require(tieneAcceso, "No tienes acceso al recurso");
        if (_accessList[tokenId][usuario] && block.timestamp < _licenciasTemporales[tokenId][usuario]) {
            return true;
        }
        _accessList[tokenId][usuario] = false;
        return false;
    }

    // Verificar si queda menos del 10% de la duración de la licencia
    function verificarAvisoLicenciaTemporal(uint256 tokenId, address usuario) external view returns (bool) {
        // Verificar que el usuario tiene una licencia temporal activa
        require(_accessList[tokenId][usuario], "No tienes acceso al recurso");
        require(block.timestamp < _licenciasTemporales[tokenId][usuario], "La licencia temporal ha expirado");

        // Calcular el tiempo restante de la licencia
        uint256 tiempoRestante = _licenciasTemporales[tokenId][usuario] - block.timestamp;
        uint256 duracionTotal = _licenciasTemporales[tokenId][usuario] - (block.timestamp - tiempoRestante);
        
        // Comprobar si queda menos del 10% de la duración total de la licencia
        if (tiempoRestante <= (duracionTotal / 10)) {
            return true;
        }
        return false; 
    }

    // Función para visualizar las licencias temporales de los archivos de un propietario

    //FALTAA



    /* ===== Transferencia de Propiedad ===== */
    function transferProperty(address nuevoPropietario, uint256 tokenId) external soloPropietario(tokenId) {
        require(nuevoPropietario != address(0), "Direccion invalida");
        //require(ownerOf(tokenId) == msg.sender, "Solo el propietario puede transferir");

        _historialTransferencias[tokenId].push(Transferencia(msg.sender, nuevoPropietario, block.timestamp));
        safeTransferFrom(msg.sender, nuevoPropietario, tokenId);

        if (!direccionesRegistradas[nuevoPropietario]) {
            direccionesRegistradas[nuevoPropietario] = true;
            propietarios.push(nuevoPropietario);
        }

        emit TransferenciaPropiedad(msg.sender, nuevoPropietario, tokenId, block.timestamp);
    }

    function transferHistory(uint256 tokenId) external view returns (Transferencia[] memory) {
        return _historialTransferencias[tokenId];
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

        _historialDisputas[tokenId].push(Disputa(msg.sender, motivoDenuncia, block.timestamp));
        emit DisputaRegistrada(msg.sender, propietario, tokenId, motivoDenuncia, block.timestamp);
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
}