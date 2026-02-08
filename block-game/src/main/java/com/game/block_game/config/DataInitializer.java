package com.game.block_game.config;

import com.game.block_game.model.Block;
import com.game.block_game.repo.BlockRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final BlockRepository repo;

    public DataInitializer(BlockRepository repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) {
        if (repo.count() == 0) {
            for (int r = 0; r < 10; r++) {
                for (int c = 0; c < 10; c++) {
                    repo.save(new Block(r, c));
                }
            }
            System.out.println("Initialized 100 blocks (10x10 grid)");
        }
    }
}
