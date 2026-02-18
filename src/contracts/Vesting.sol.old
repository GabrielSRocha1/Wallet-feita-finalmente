
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VerumLinearVesting
 * @dev Contrato de Vesting Linear que libera tokens gradualmente para um beneficiário.
 *      Implementa cliff, duração configurável, e possibilidade de revogação.
 */
contract VerumLinearVesting is Ownable {
    using SafeERC20 for IERC20;

    // EVENTOS QUE OCORREM NO CONTRATO
    event TokensReleased(address token, uint256 amount);
    event VestingRevoked();

    // ENDEREÇO DA CARTEIRA DO BENEFICIÁRIO
    address private _beneficiary;

    // DATA DE INÍCIO DO VESTING (TIMESTAMP UNIX)
    uint256 private _start;

    // DURAÇÃO DO PERÍODO DE VESTING (EM SEGUNDOS)
    uint256 private _duration;

    // PERÍODO DE CLIFF (EM SEGUNDOS) - Tempo antes do qual nenhum token é liberado
    uint256 private _cliff;

    // INDICA SE O CONTRATO PODE SER CANCELADO PELO PROPRIETÁRIO
    bool private _revocable;

    // INDICA SE O CONTRATO FOI REVOGADO
    bool private _revoked;

    // MAPEAMENTO PARA RASTREAR O TOTAL DE TOKENS JÁ LIBERADOS POR CADA TOKEN ERC20
    mapping(address => uint256) private _released;

    /**
     * @dev Construtor do contrato. Define os parâmetros imutáveis do vesting.
     * @param beneficiaryAddress Endereço que receberá os tokens.
     * @param startTimestamp A data/hora (unix timestamp) de início do vesting.
     * @param cliffSeconds Duração em segundos do período de cliff (carência).
     * @param durationSeconds Duração total do vesting em segundos.
     * @param revocable_ Se verdadeiro, o proprietário pode cancelar o vesting e reaver tokens não liberados.
     */
    constructor(
        address beneficiaryAddress,
        uint256 startTimestamp,
        uint256 cliffSeconds,
        uint256 durationSeconds,
        bool revocable_
    ) Ownable(msg.sender) {
        require(beneficiaryAddress != address(0), "VerumVesting: beneficiario e o endereco zero");
        require(cliffSeconds <= durationSeconds, "VerumVesting: cliff deve ser menor que duracao");
        require(durationSeconds > 0, "VerumVesting: duracao deve ser maior que 0");
        // Se o start for 0, usamos o timestamp do bloco atual
        require(startTimestamp + durationSeconds > block.timestamp, "VerumVesting: tempo final e anterior ao atual");

        _beneficiary = beneficiaryAddress;
        _start = startTimestamp;
        _cliff = startTimestamp + cliffSeconds;
        _duration = durationSeconds;
        _revocable = revocable_;
    }

    /**
     * @dev Retorna o beneficiário dos tokens.
     */
    function beneficiary() public view virtual returns (address) {
        return _beneficiary;
    }

    /**
     * @dev Retorna o tempo de início do vesting.
     */
    function start() public view virtual returns (uint256) {
        return _start;
    }

    /**
     * @dev Retorna a duração do vesting.
     */
    function duration() public view virtual returns (uint256) {
        return _duration;
    }

    /**
     * @dev Retorna o tempo final do cliff.
     */
    function cliff() public view virtual returns (uint256) {
        return _cliff;
    }

    /**
     * @dev Retorna a quantidade de tokens já liberados.
     */
    function released(address token) public view virtual returns (uint256) {
        return _released[token];
    }

    /**
     * @dev Retorna verdadeiro se o contrato pode ser revogado.
     */
    function revocable() public view virtual returns (bool) {
        return _revocable;
    }

    /**
     * @dev Retorna verdadeiro se o contrato já foi revogado.
     */
    function revoked() public view virtual returns (bool) {
        return _revoked;
    }

    /**
     * @dev Libera (transfere) os tokens disponíveis para o beneficiário.
     * @param token O endereço do contrato do token ERC20 a ser liberado.
     */
    function release(IERC20 token) public virtual {
        uint256 unreleased = releasableAmount(address(token));
        require(unreleased > 0, "VerumVesting: nenhum token disponivel para liberacao");

        _released[address(token)] = _released[address(token)] + unreleased;
        token.safeTransfer(_beneficiary, unreleased);

        emit TokensReleased(address(token), unreleased);
    }

    /**
     * @dev Revoga o vesting. Tokens já adquiridos permanecem com o beneficiário.
     * O restante é devolvido ao proprietário. Só pode ser chamado se for 'revocable'.
     * @param token O token ERC20 sendo vestindo.
     */
    function revoke(IERC20 token) public virtual onlyOwner {
        require(_revocable, "VerumVesting: nao pode ser revogado");
        require(!_revoked, "VerumVesting: token ja revogado");

        uint256 balance = token.balanceOf(address(this));
        uint256 unreleased = releasableAmount(address(token));
        uint256 refund = balance - unreleased;

        _revoked = true;

        token.safeTransfer(owner(), refund);
        emit VestingRevoked();
    }

    /**
     * @dev Calcula a quantidade de tokens que já podem ser liberados (vested amount - released).
     * @param token O endereço do token ERC20.
     */
    function releasableAmount(address token) public view returns (uint256) {
        return vestedAmount(token, uint64(block.timestamp)) - _released[token];
    }

    /**
     * @dev Calcula a quantidade total de tokens que já cumpriram o período de vesting até um timestamp específico.
     * @param token O endereço do token ERC20.
     * @param timestamp O momento no tempo para calcular o vesting.
     */
    function vestedAmount(address token, uint64 timestamp) public view returns (uint256) {
        uint256 currentBalance = IERC20(token).balanceOf(address(this));
        uint256 totalBalance = currentBalance + _released[token];

        if (timestamp < _cliff) {
            return 0; // Nada liberado antes do cliff
        } else if (timestamp >= _start + _duration || _revoked) {
            return totalBalance; // Tudo liberado após o fim da duração ou se revogado
        } else {
            // Cálculo linear: (Total * TempoPassado) / DuraçãoTotal
            return (totalBalance * (timestamp - _start)) / _duration;
        }
    }
}
