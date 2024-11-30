import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client"; // Cliente IPFS
import { AES, enc } from "crypto-js";  // No necesitamos SHA3, ya que la clave viene del contrato
import { Buffer } from "buffer";

// Proveedor de Ethereum
const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);

// Instancia del contrato en Ethereum
const propietarioContract = new ethers.Contract(
  addresses.ipfs,
  abis.ipfs,
  defaultProvider
);

function RecursosAccesoLicencia({ closeModal, selectedFile }) {
  const { tokenId, hash } = selectedFile;  // Asegúrate de obtener 'tokenId' y 'hash' correctamente
  const [activeOption, setActiveOption] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [archivoDescifrado, setArchivoDescifrado] = useState(null);

  // Funcionalidades
  const functionalities = [
    { title: "Acceder al archivo", action: () => setActiveOption("acceso"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
  ];

  // Obtener la clave de descifrado (ya derivada en el contrato)
  const obtenerClaveDescifrado = async () => {
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);

      // Llamamos al contrato para obtener la clave asociada al tokenId y el address del usuario
      const claveDescifrada = await contratoConSigner.obtenerClaveConNonce(tokenId, signer.getAddress());  // El contrato ya devuelve la clave derivada
      console.log(claveDescifrada)
      return claveDescifrada.data;
    } catch (error) {
      console.error("Error al obtener la clave de descifrado:", error.message);
      setErrorMessage("No se pudo obtener la clave de descifrado.");
      return null;
    }
  };

  // Obtener el archivo de IPFS
  const obtenerArchivoDeIPFS = async (hash) => {
    const client = create("/ip4/127.0.0.1/tcp/5001"); // Conexión IPFS local
    try {
      const archivoGenerator = client.cat(hash);
      let archivoCifrado = [];

      // Consumir el AsyncGenerator y almacenar los bloques en un array
      for await (const chunk of archivoGenerator) {
        archivoCifrado.push(chunk);  // Almacena los chunks binarios
      }

      // Unir todos los bloques en un solo Buffer
      const archivoBuffer = Buffer.concat(archivoCifrado);

      console.log("Archivo cifrado obtenido de IPFS:", archivoBuffer); // Verificar el Buffer del archivo
      return archivoBuffer; // Devuelve el archivo como un Buffer
    } catch (error) {
      console.error("Error al obtener el archivo desde IPFS:", error.message);
      setErrorMessage("No se pudo obtener el archivo de IPFS.");
      return null;
    }
  };


// Función para descifrar el archivo
const descifrarArchivo = (archivoCifrado, claveHex) => {
  try {
    // Si el archivo cifrado está en Buffer, conviértelo a Base64
    if (Buffer.isBuffer(archivoCifrado)) {
      archivoCifrado = archivoCifrado.toString('utf-8');
    }
    let claveSinPrefijo = claveHex.slice(2);
    console.log(claveSinPrefijo)

    // Si la clave es un Buffer o Uint8Array, convertirla a cadena hexadecimal
    if (Buffer.isBuffer(claveSinPrefijo)) {
      claveSinPrefijo = claveSinPrefijo.toString('hex');
    }
    console.log(claveSinPrefijo.length)
    // Asegúrate de que la clave es la correcta (32 bytes de largo)
    if (!claveSinPrefijo || claveSinPrefijo.length !== 64) {
      throw new Error("La clave debe ser de 32 bytes (64 caracteres hexadecimales).");
    }

    // Desencriptar el archivo cifrado usando AES
    const bytes = AES.decrypt(archivoCifrado, claveSinPrefijo);

    // Verifica si la desencriptación fue exitosa
    const archivoDescifrado = bytes.toString(enc.Base64); // Convertir bytes a Base64

    if (!archivoDescifrado) {
      throw new Error("Descifrado fallido.");
    }

    // Convertir Base64 a Buffer para procesar el archivo
    const archivoBuffer = Buffer.from(archivoDescifrado, 'base64');
    return archivoBuffer;  // Retorna el archivo descifrado como Buffer

  } catch (error) {
    console.error("Error al descifrar el archivo:", error.message);
    return null;  // En caso de error, retorna null
  }
};

  

  // Función para acceder y descifrar el archivo
  const accederArchivo = async (e) => {
    e.preventDefault();
    try {
      const claveDescifrado = await obtenerClaveDescifrado(); // Obtener la clave de descifrado
      if (!claveDescifrado) {
        setErrorMessage("Clave de descifrado no encontrada.");
        return;
      }

      const archivoCifrado = await obtenerArchivoDeIPFS(hash);  // Obtener el archivo desde IPFS
      if (!archivoCifrado) {
        setErrorMessage("Archivo no encontrado en IPFS.");
        return;
      }

      // Descifrar el archivo
      await descifrarArchivo(archivoCifrado, claveDescifrado);
    } catch (error) {
      setErrorMessage("Error al acceder o descifrar el archivo.");
    }
  };

  // Función para verificar el tipo de archivo basado en sus primeros bytes
  const getFileType = (data) => {
    const firstBytes = data.slice(0, 4).toString('hex'); // Obtener los primeros 4 bytes en hexadecimal

    if (firstBytes === '25504446') {
      return 'pdf';  // PDF
    } else if (firstBytes === '89504e47') {
      return 'png';  // PNG
    } else if (firstBytes === 'ffd8') {
      return 'jpg';  // JPG
    } else {
      return 'unknown';  // Otro tipo de archivo
    }
  };

  // Función para renderizar el contenido de la opción activa
  const renderOptionContent = () => {
    return (
      <>
        <h3 className="text-lg font-semibold">Acceder y descifrar el archivo</h3>
        <form onSubmit={accederArchivo}>
          <button
            type="submit"
            className="bg-teal-600 hover:bg-teal-700 text-white mt-4 py-2 px-4 rounded w-full"
          >
            Acceder al contenido del archivo
          </button>
          {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
        </form>

        {archivoDescifrado && (
          <div className="mt-4">
            <h4 className="font-semibold">Contenido del archivo descifrado:</h4>
            <div>
              {/* Verificar el tipo del archivo y mostrar el enlace de descarga adecuado */}
              {getFileType(archivoDescifrado) === 'pdf' ? (
                <a
                  href={URL.createObjectURL(new Blob([archivoDescifrado], { type: 'application/pdf' }))} // Si es PDF
                  download="archivo_descifrado.pdf"
                  className="bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded"
                >
                  Descargar el PDF
                </a>
              ) : getFileType(archivoDescifrado) === 'png' ? ( // Si es una imagen PNG
                <a
                  href={URL.createObjectURL(new Blob([archivoDescifrado], { type: 'image/png' }))} // Si es imagen PNG
                  download="imagen_descifrada.png"
                  className="bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded"
                >
                  Descargar la imagen
                </a>
              ) : getFileType(archivoDescifrado) === 'jpg' ? ( // Si es una imagen JPG
                <a
                  href={URL.createObjectURL(new Blob([archivoDescifrado], { type: 'image/jpeg' }))} // Si es imagen JPG
                  download="imagen_descifrada.jpg"
                  className="bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded"
                >
                  Descargar la imagen
                </a>
              ) : (
                <p>El archivo no es compatible con este visor.</p>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="modal-container">
      <h2 className="text-2xl font-semibold">Opciones para acceder al archivo</h2>
      <div className="mt-4">{renderOptionContent()}</div>
    </div>
  );
}

export default RecursosAccesoLicencia;
