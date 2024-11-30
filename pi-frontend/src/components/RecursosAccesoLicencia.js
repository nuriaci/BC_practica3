import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client"; // Cliente IPFS
import { AES, enc } from "crypto-js";
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

  // Obtener clave de descifrado
  const obtenerClaveDescifrado = async () => {
    try {
      const signer = defaultProvider.getSigner();
      const contratoConSigner = propietarioContract.connect(signer);
      const txReceipt = await contratoConSigner.obtenerClaveConNonce(tokenId, "0x67139abeb5518d538924318CdA1797119844d3CA");
  
      console.log("Recibo de transacción:", txReceipt);  // Verificar la transacción completa
  
      // Extraer la clave de descifrado del campo 'data'
      const claveDescifrado = txReceipt.data;
  
      if (!claveDescifrado) {
        console.error("No se encontró la clave de descifrado en la transacción.");
        setErrorMessage("No se encontró la clave de descifrado.");
        return null;
      }
  
      console.log("Clave de descifrado extraída:", claveDescifrado);  // Verificar la clave extraída
  
      // La clave es probablemente un valor hexadecimal, asegúrate de que está en formato correcto
      return claveDescifrado;
    } catch (error) {
      console.error("Error al obtener la clave de descifrado:", error.message);
      setErrorMessage("No se pudo obtener la clave de descifrado.");
      return null;
    }
  };
  

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
  
  const descifrarArchivo = async (archivoCifrado, key) => {
    try {
      // Quitar el '0x' si está presente en la clave
      if (key.startsWith('0x')) {
        key = key.slice(2);
      }
  
      console.log("Archivo cifrado:", archivoCifrado);  // Verificar el archivo cifrado (como Buffer)
      console.log("Clave para descifrado:", key);  // Verificar la clave
  
      // Convertir el archivo cifrado (Buffer) a Base64
      const archivoBase64 = archivoCifrado.toString('base64'); // Convertir el Buffer en Base64
  
      // Desencriptar el archivo con AES
      const bytes = AES.decrypt(archivoBase64, key); // archivoCifrado es Base64
  
      // Los bytes se deben convertir directamente a un Buffer binario
      const contenidoDescifrado = bytes.toString(enc.Base64); // Usamos Base64 porque los datos binarios pueden no ser válidos UTF-8
  
      // Verificamos si la conversión produjo algo válido
      if (!contenidoDescifrado) {
        throw new Error("Descifrado fallido.");
      }
  
      // Convertir Base64 a Buffer (para ser procesado como archivo)
      const contenidoBuffer = Buffer.from(contenidoDescifrado, 'base64');
      setArchivoDescifrado(contenidoBuffer); // Mostrar el archivo como Buffer
  
    } catch (error) {
      console.error("Error al descifrar el archivo:", error.message);
      setErrorMessage("No se pudo descifrar el archivo.");
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
                <p>Tipo de archivo no reconocido.</p>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-cover bg-center bg-opacity-70 bg-gradient-to-br text-white rounded-lg shadow-lg p-6 sm:p-8 w-full sm:w-auto max-w-lg relative transform transition-all duration-300 scale-95 hover:scale-100">
        <button
          onClick={closeModal}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200 text-lg"
        >
          &times;
        </button>
        {activeOption && (
          <button
            onClick={() => setActiveOption(null)}  // Resetear al menú principal
            className="absolute top-2 left-2 text-gray-200 hover:text-white text-xl transition-all"
          >
            &larr; {/* Flecha para volver */}
          </button>
        )}

        <h2 className="text-2xl font-semibold mb-4 text-center">
          {activeOption ? "Detalle de opción" : "Opciones para el propietario"}
        </h2>

        {renderOptionContent()}
      </div>
    </div>
  );
}

export default RecursosAccesoLicencia;
