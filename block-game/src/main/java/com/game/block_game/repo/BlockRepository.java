package com.game.block_game.repo;


import org.springframework.data.jpa.repository.JpaRepository;

import com.game.block_game.model.Block;

public interface BlockRepository extends JpaRepository<Block, Long> {
}
