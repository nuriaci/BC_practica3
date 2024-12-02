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
    function actualizarAcceso(address usuario, uint256 tokenId, bool acceso) external;
    function validarAcceso(address usuario, uint256 tokenId) external view returns (bool);
}


contract PropiedadIntelectual is ERC721URIStorage {
    struct Archivo {
        string titulo;
        string descripcion;
        string hash;
        uint256 tiempo;
        uint256 tokenId;
        bytes32 claveCifrado;
        string mimeType;
        bytes32 iv;
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
    mapping(uint256 => address[]) private usuariosConAcceso;

    // Mapeo para guardar el consentimiento explícito de los usuarios
    mapping(address => bool) private _consentimientoDado;

    // Mappings para claims
    mapping(uint256 => mapping(address => Claim)) private claims;

    // Mapeo para guardar claves
    mapping(uint256 => bytes32) private clavesCifrado; 
    mapping(uint256 => uint256) private nonces; 

    // Mapping para cifrar (iv)
    mapping(uint256 => bytes32) public ivs;     

    // Dirección del oráculo
    address private oracleAddress;


    event ConsentimientoAceptado(address usuario);
    event RegistroRealizado(address indexed propietario, string hash_ipfs, string titulo, uint256 fecha, uint256 tokenId);
    event TransferenciaPropiedad(bytes32 hashTransferencia, uint256 fecha);
    event DisputaRegistrada(bytes32 hashDisputa, string motivo, uint256 fecha);
    event ArchivoEliminado(string hash_ipfs, uint256 tokenId);


    // Eventos para claims
    event ClaimEmitido(address indexed usuario, uint256 tokenId, uint256 duracion);
    event ClaimRevocado(address indexed usuario, uint256 tokenId);
    event ClaimRenovado(address indexed usuario, uint256 tokenId, uint256 nuevaDuracion);
    event AccesosListados(uint256 tokenId, Claim[] claims);

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
 
    function eliminarArchivo(uint256 tokenId) external soloPropietario(tokenId) {
        // Obtener el hash del archivo
        string memory hash_ipfs;
        Archivo[] storage archivos = _archivos[msg.sender];
        for (uint256 i = 0; i < archivos.length; i++) {
            if (archivos[i].tokenId == tokenId) {
                hash_ipfs = archivos[i].hash;
                archivos[i] = archivos[archivos.length - 1];
                archivos.pop();
                break;
            }
        }

        _burn(tokenId);
        emit ArchivoEliminado(hash_ipfs, tokenId);
    }


    /* Funciones relacionadas con los verifiable claims */
   // Función para emitir un claim de acceso a un archivo para un usuario
    function emisionClaims(address usuario, uint256 tokenId, uint256 duracionClaim) public soloPropietario(tokenId) {
        // Solo se agrega el claim si el usuario no está en la lista ya
        require(!usuarioTieneAcceso(usuario, tokenId), "El usuario ya tiene acceso");

        claims[tokenId][usuario] = Claim({
            usuario: usuario,
            tokenId: tokenId,
            fecha: block.timestamp,
            duracion: duracionClaim == 0 ? 0 : block.timestamp + duracionClaim,
            acceso: true
        });

        IOracle oracle = IOracle(oracleAddress);
        oracle.actualizarAcceso(usuario, tokenId, true);

        usuariosConAcceso[tokenId].push(usuario); // Añadir el usuario a la lista de accesos
        emit ClaimEmitido(usuario, tokenId, duracionClaim);
    }

    // Función para verificar si un usuario tiene acceso
    function usuarioTieneAcceso(address usuario, uint256 tokenId) public view returns (bool) {
        // Verificar si el usuario está en la lista de acceso del archivo
        for (uint256 i = 0; i < usuariosConAcceso[tokenId].length; i++) {
            if (usuariosConAcceso[tokenId][i] == usuario) {
                return true;
            }
        }
        return false;
    }

    // Función para revocar el acceso de un usuario
    function revocacionClaims(address usuario, uint256 tokenId) public soloPropietario(tokenId) {
        Claim storage claim = claims[tokenId][usuario];
        require(claim.acceso == true, "El claim no esta activo.");

        // Revocar el acceso en el oráculo
        IOracle oracle = IOracle(oracleAddress);
        oracle.actualizarAcceso(usuario, tokenId, false);

        claim.acceso = false;
        eliminarUsuarioDeAccesos(tokenId, usuario); // Eliminar al usuario de la lista de acceso
        emit ClaimRevocado(usuario, tokenId);
    }

    // Función para eliminar un usuario de la lista de acceso
    function eliminarUsuarioDeAccesos(uint256 tokenId, address usuario) private {
        uint256 indexToRemove = type(uint256).max;
        // Buscar el índice del usuario a eliminar
        for (uint256 i = 0; i < usuariosConAcceso[tokenId].length; i++) {
            if (usuariosConAcceso[tokenId][i] == usuario) {
                indexToRemove = i;
                break;
            }
        }

        // Si se encontró el usuario en la lista, eliminarlo
        if (indexToRemove != type(uint256).max) {
            // Reemplazar el usuario eliminado con el último usuario de la lista
            usuariosConAcceso[tokenId][indexToRemove] = usuariosConAcceso[tokenId][usuariosConAcceso[tokenId].length - 1];
            usuariosConAcceso[tokenId].pop();  // Eliminar el último elemento (reemplazando el usuario removido)
        }
    }

    // Función para listar los usuarios con acceso a un archivo
    function listarUsuariosConAcceso(uint256 tokenId) public view returns (address[] memory) {
        return usuariosConAcceso[tokenId];
    }


    // Función para verificar los claims activos de los usuarios
    function verificacionClaims(address usuario, uint256 tokenId) public view returns (bool) {
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

    function revocarLicenciasVencidas(uint256 tokenId) public soloPropietario(tokenId) {
    // Obtener los usuarios con acceso
    address[] storage usuarios = usuariosConAcceso[tokenId];
    
    for (uint256 i = 0; i < usuarios.length; ) {
        address usuario = usuarios[i];
        Claim storage claim = claims[tokenId][usuario];

        // Si es temporal y expiró
        if (claim.duracion > 0 && block.timestamp > claim.duracion) {
            // Revocar acceso
            claim.acceso = false;

            // Remover usuario de la lista de acceso
            eliminarUsuarioDeAccesos(tokenId, usuario);

            // Actualizar el oráculo
            IOracle oracle = IOracle(oracleAddress);
            oracle.actualizarAcceso(usuario, tokenId, false);

            // Emitir el evento de revocación
            emit ClaimRevocado(usuario, tokenId);

            // No incrementa directamente i porque eliminamos usuarios
            continue;
        }
        i++;
    }
}


    /* ===== Registro de Propiedad ===== */
    function registro(string calldata hash_ipfs, string calldata titulo, string calldata descripcion, bytes32 claveCifrado, bytes32 iv, string calldata mimeType) external {
        require(_consentimientoDado[msg.sender], "Debes aceptar los terminos y condiciones antes de registrar");
        require(bytes(hash_ipfs).length > 0, "Hash invalido");
        require(bytes(titulo).length > 0, "Titulo invalido");
        require(bytes(descripcion).length > 0, "Descripcion invalida");

        uint256 tokenId = ++_tokenIdCounter; 
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", hash_ipfs)));

        _archivos[msg.sender].push(Archivo(titulo, descripcion, hash_ipfs, block.timestamp, tokenId, claveCifrado, mimeType,iv));

        if (!direccionesRegistradas[msg.sender]) {
            direccionesRegistradas[msg.sender] = true;
            propietarios.push(msg.sender);
        }

        // Almacenar la clave de cifrado y IV para este archivo
        clavesCifrado[tokenId] = claveCifrado;
        ivs[tokenId] = iv;  // Almacenar el IV asociado al archivo

        // Iniciar el nonce para este archivo (si es necesario)
        //nonces[tokenId] = 0;

        emisionClaims(msg.sender, tokenId, 0);
        emit RegistroRealizado(msg.sender, hash_ipfs, titulo, block.timestamp, tokenId);
    }

    function obtenerIV(uint256 tokenId) external view returns (bytes32) {
        return ivs[tokenId];  
    }
    function concederAcceso(address usuario, uint256 tokenId) external soloPropietario(tokenId) {
        emisionClaims(usuario, tokenId, 0);
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

    function descifrarArchivo(uint256 tokenId) external view returns (bytes32) {
        // Verificar que el usuario tiene un claim válido
        require(verificacionClaims(msg.sender, tokenId), "No tienes acceso");

        // Retornar la clave derivada con el nonce actual
        return obtenerClaveConNonce(tokenId, msg.sender);
    }

    function listarClaimsArchivo(uint256 tokenId) public soloPropietario(tokenId) returns (Claim[] memory) {
        // Revocar licencias vencidas antes de listar
        revocarLicenciasVencidas(tokenId);

        uint256 claimsTotales = 0;

        // Recorrer todas las direcciones de usuarios con acceso
        for (uint256 i = 0; i < usuariosConAcceso[tokenId].length; i++) {
            address usuario = usuariosConAcceso[tokenId][i];
            Claim storage claim = claims[tokenId][usuario];

            // Verificar que el claim esté activo y no haya expirado
            if (claim.acceso && (claim.duracion == 0 || block.timestamp <= claim.duracion)) {
                claimsTotales++;
            }
        }

        // Crear el arreglo para los claims válidos
        Claim[] memory listaClaims = new Claim[](claimsTotales);
        uint256 index = 0;

        // Llenar el arreglo con los claims válidos
        for (uint256 i = 0; i < usuariosConAcceso[tokenId].length; i++) {
            address usuario = usuariosConAcceso[tokenId][i];
            Claim storage claim = claims[tokenId][usuario];

            // Verificar si el claim sigue siendo válido
            if (claim.acceso && (claim.duracion == 0 || block.timestamp <= claim.duracion)) {
                listaClaims[index] = claim;
                index++;
            }
        }

        // Emitir el evento con los datos de los accesos listados
        emit AccesosListados(tokenId, listaClaims);

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
        // Verificar que el usuario tiene acceso
        require(verificacionClaims(usuario, tokenId), "No tienes acceso");

        // Verificar que la clave cifrada esté definida para el tokenId
        require(clavesCifrado[tokenId] != bytes32(0), "Clave no encontrada");

        // Obtener el nonce del tokenId
        uint256 currentNonce = nonces[tokenId];

        // Realizar el hash con keccak256 (concatenando clave y nonce)
        bytes32 claveDerivada = keccak256(abi.encodePacked(clavesCifrado[tokenId], currentNonce));

        // Devolver la clave derivada
        return claveDerivada;
    }

    function obtenerTipoMime(address propietario, uint256 tokenId) public view returns (string memory) {
        // Recorrer los archivos del propietario
        Archivo[] storage archivosPropietario = _archivos[propietario];

        for (uint256 i = 0; i < archivosPropietario.length; i++) {
            if (archivosPropietario[i].tokenId == tokenId) {
                return archivosPropietario[i].mimeType;  // Retorna el mimeType del archivo correspondiente al tokenId
            }
        }

        revert("Archivo no encontrado");  // Si no se encuentra el archivo con ese tokenId
    }




}