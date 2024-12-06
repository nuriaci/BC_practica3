import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client";
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";

const wordArrayToUint8Array = (wordArray) => {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);
  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xFF;
  }
  return u8;
};

const defaultProvider = new ethers.providers.Web3Provider(window.ethereum);
const propietarioContract = new ethers.Contract(
  addresses.ipfs,
  abis.ipfs,
  defaultProvider
);

function RecursosAccesoLicencia({ closeModal, selectedFile }) {
  const { tokenId, direccionPropietario, hash } = selectedFile;
  const [activeOption, setActiveOption] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [archivoDescifrado, setArchivoDescifrado] = useState(null);

  const functionalities = [
    { title: "Acceder al archivo", action: () => setActiveOption("acceso"), icon: <ArrowsRightLeftIcon className="w-8 h-8" /> },
  ];

  const obtenerClaveDescifrado = async () => {
    try {
      const signer = defaultProvider.getSigner();
      const userAddress = await signer.getAddress();
      const contratoConSigner = propietarioContract.connect(signer);
      const claveDescifrada = await contratoConSigner.obtenerClave(tokenId, userAddress);
      return claveDescifrada;
    } catch (error) {
      console.error("Error al obtener la clave de descifrado:", error.message);
      setErrorMessage("No se pudo obtener la clave de descifrado.");
      return null;
    }
  };

  const obtenerArchivoDeIPFS = async (hash) => {
     // Usando el gateway público de Piñata
    const response = await fetch(`https://gateway.pinata.cloud/ipfs/${hash}`);
    try {
        // Verificar que la respuesta sea exitosa
      if (!response.ok) {
        throw new Error('Error al obtener el archivo desde Piñata.');
      }

      // Convertir la respuesta a un Blob (contenido binario)
      const archivo = await response.blob();
      return archivo;
    } catch (error) {
      console.error("Error al obtener el archivo desde IPFS:", error.message);
      setErrorMessage("No se pudo obtener el archivo de IPFS.");
      return null;
    }
  };

  const obtenerTipoMime = async (tokenId) => {
    try {
      const contratoConSigner = propietarioContract.connect(defaultProvider.getSigner());
      const mimeType = await contratoConSigner.obtenerTipoMime(direccionPropietario, tokenId);
      console.log(mimeType);
      return mimeType;
    } catch (error) {
      console.error("Error al obtener el tipo MIME:", error.message);
      setErrorMessage("No se pudo obtener el tipo MIME del archivo.");
      return "application/octet-stream";
    }
  };

  const descifrarArchivo = (archivoCifradoBuffer, claveHex, ivHex, mimeType) => {
    try {
      // Eliminar prefijos '0x' si existen
      const claveSinPrefijo = claveHex.startsWith("0x") ? claveHex.slice(2) : claveHex;
      const ivSinPrefijo = ivHex.startsWith("0x") ? ivHex.slice(2) : ivHex;

      // Convertir clave e IV a WordArray
      const keyWordArray = CryptoJS.enc.Hex.parse(claveSinPrefijo);
      const ivWordArray = CryptoJS.enc.Hex.parse(ivSinPrefijo);

      // Convertir archivo cifrado (Buffer) a WordArray
      const archivoCifradoUint8Array = new Uint8Array(archivoCifradoBuffer);
      const ciphertextWordArray = CryptoJS.lib.WordArray.create(archivoCifradoUint8Array);

      // Crear CipherParams para CryptoJS
      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertextWordArray });

      // Descifrar usando AES-CBC
      const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
        iv: ivWordArray,
        padding: CryptoJS.pad.Pkcs7, // Asegurarse de usar el mismo padding que en el cifrado
      });

      const decryptedBytes = wordArrayToUint8Array(decrypted)

      // Crear un Blob con el contenido descifrado y el tipo MIME
      return new Blob([decryptedBytes], { type: mimeType });
    } catch (error) {
      console.error("Error al descifrar el archivo:", error.message);
      return null;
    }
  };

  const obtenerIVDesdeContrato = async (tokenId) => {
    try {
      const iv = await propietarioContract.obtenerIV(tokenId);
      return iv;
    } catch (error) {
      console.error("Error al obtener el IV:", error.message);
      setErrorMessage("No se pudo obtener el IV.");
      return null;
    }
  };

  const accederArchivo = async (e) => {
    e.preventDefault();
    try {
      const claveDescifrado = await obtenerClaveDescifrado();
      if (!claveDescifrado) {
        setErrorMessage("Clave de descifrado no encontrada.");
        return;
      }

      const archivoCifrado = await obtenerArchivoDeIPFS(hash);
      if (!archivoCifrado) {
        setErrorMessage("Archivo no encontrado en IPFS.");
        return;
      }

      const tipoMime = await obtenerTipoMime(tokenId);
      const iv = await obtenerIVDesdeContrato(tokenId);
      if (!iv) {
        setErrorMessage("No se pudo obtener el IV.");
        return;
      }

      const archivoDescifradoResultado = descifrarArchivo(archivoCifrado, claveDescifrado, iv, tipoMime);
      console.log(archivoDescifradoResultado);
      if (archivoDescifradoResultado) {
        setArchivoDescifrado(archivoDescifradoResultado);
      } else {
        setErrorMessage("Error al descifrar el archivo.");
      }
    } catch (error) {
      console.error("Error al acceder o descifrar el archivo:", error.message);
      setErrorMessage("Error al acceder o descifrar el archivo.");
    }
  };

  return (
    <div className="modal-container">
      <h2 className="text-2xl font-semibold">Opciones para acceder al archivo</h2>
      <div className="mt-6">
        {functionalities.map((func, idx) => (
          <button
            key={idx}
            onClick={func.action}
            className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
          >
            {func.title}
          </button>
        ))}
      </div>
      
      {activeOption === "acceso" && (
        <>
          <form onSubmit={accederArchivo}>
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-600 text-white mt-4 py-2 px-4 rounded w-full"
            >
              Acceder al Archivo
            </button>
            {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
          </form>
          {archivoDescifrado && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Vista Previa del Archivo</h3>
              <div className="mt-4 bg-gray-900 p-4 rounded shadow-md">
                {archivoDescifrado.type.startsWith("image/") && (
                  <img
                    src={URL.createObjectURL(archivoDescifrado)}
                    alt="Archivo Descifrado"
                    className="w-full rounded"
                  />
                )}
                {archivoDescifrado.type.startsWith("application/pdf") && (
                  <embed
                    src={URL.createObjectURL(archivoDescifrado)}
                    type="application/pdf"
                    className="w-full h-96 rounded"
                  />
                )}
                {!archivoDescifrado.type.startsWith("image/") &&
                  !archivoDescifrado.type.startsWith("application/pdf") && (
                    <iframe
                      src={URL.createObjectURL(archivoDescifrado)}
                      className="w-full h-96 rounded"
                      title="Archivo Descifrado"
                    ></iframe>
                  )}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={closeModal}
        className="bg-red-500 hover:bg-red-600 text-white mt-4 py-2 px-4 rounded w-full"
      >
        Cerrar
      </button>
    </div>
  );
}

export default RecursosAccesoLicencia;
