import React, { useState } from "react";
import { ethers } from "ethers";
import { addresses, abis } from "../contracts";
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { create } from "kubo-rpc-client";
import CryptoJS from 'crypto-js';
import { Buffer } from "buffer";

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
      const claveDescifrada = await contratoConSigner.obtenerClaveConNonce(tokenId, userAddress);
      return claveDescifrada;
    } catch (error) {
      console.error("Error al obtener la clave de descifrado:", error.message);
      setErrorMessage("No se pudo obtener la clave de descifrado.");
      return null;
    }
  };

  const obtenerArchivoDeIPFS = async (hash) => {
    const client = create("/ip4/127.0.0.1/tcp/5002");
    try {
      const archivoGenerator = client.cat(hash);
      let archivoCifrado = [];
      for await (const chunk of archivoGenerator) {
        archivoCifrado.push(chunk);
      }
      return Buffer.concat(archivoCifrado);
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
      return mimeType;
    } catch (error) {
      console.error("Error al obtener el tipo MIME:", error.message);
      setErrorMessage("No se pudo obtener el tipo MIME del archivo.");
      return "application/octet-stream";
    }
  };

  const descifrarArchivo = (archivoCifradoBuffer, claveHex, iv, mimeType) => {
    try {
      const claveSinPrefijo = claveHex.startsWith("0x") ? claveHex.slice(2) : claveHex;
      const keyWordArray = CryptoJS.enc.Hex.parse(claveSinPrefijo);
      const ivWordArray = CryptoJS.enc.Hex.parse(iv);

      const archivoCifradoUint8Array = new Uint8Array(archivoCifradoBuffer);
      const ciphertextWordArray = CryptoJS.lib.WordArray.create(archivoCifradoUint8Array);
      const cipherParams = CryptoJS.lib.CipherParams.create({ ciphertext: ciphertextWordArray });

      // Decrypt using AES-CBC
      const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, { iv: ivWordArray });

      const uint8Array = new Uint8Array(decrypted.sigBytes);
      for (let i = 0; i < decrypted.sigBytes; i++) {
        uint8Array[i] = (decrypted.words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      }

      const mimeType = obtenerTipoMime(tokenId);

      console.log(mimeType);
      return new Blob([uint8Array], { type: mimeType });
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
      <form onSubmit={accederArchivo}>
        <button
          type="submit"
          className="bg-teal-600 hover:bg-teal-700 text-white mt-4 py-2 px-4 rounded w-full"
        >
          Descargar el archivo descifrado
        </button>
        {errorMessage && <p className="text-red-500 mt-4">{errorMessage}</p>}
      </form>

      {archivoDescifrado && (
        <a
          href={URL.createObjectURL(archivoDescifrado)}
          download="archivo_descifrado"
          className="bg-teal-600 hover:bg-teal-700 text-white py-2 px-4 rounded mt-4 inline-block"
        >
          Descargar archivo
        </a>
      )}
    </div>
  );
}

export default RecursosAccesoLicencia;
